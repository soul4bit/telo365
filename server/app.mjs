import { createServer } from 'node:http';
import { createReadStream, statSync, realpathSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from './database.mjs';
import { accounts, getUser } from './accounts.mjs';
import { journal } from './journal.mjs';
import { createMailer } from './mail.mjs';
import { emailAuth } from './email-auth.mjs';
import { marketing } from './marketing.mjs';
import { createStoreCatalog } from './stores/catalog.mjs';
import { fail, readJson, rateLimit } from './security.mjs';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
export function createApplication(options={}) {
  const production=options.production??process.env.NODE_ENV==='production';
  const origins=(options.origins||process.env.TELO_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173').split(',');
  if(production&&origins.some(o=>!o.startsWith('https://')))throw new Error('Production origins must use HTTPS');
  const db=openDatabase(options.dbPath||process.env.TELO_DB||'data/telo365.sqlite');
  const storeCatalog=createStoreCatalog({db,production,enableMock:options.enableMockStores});
  const mailer=options.mailer||createMailer();
  const allowedHosts=new Set(origins.map(o=>new URL(o).host));
  const cookieName=production?'__Host-telo365':'telo365_session';
  const staticDir=resolve(options.staticDir||'dist');
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const method=req.method||'GET';
    try {
      const url=new URL(req.url||'/','http://internal');const path=url.pathname;
      if(path==='/healthz'||path==='/api/health') { if(method!=='GET'&&method!=='HEAD')fail(405,'Метод не разрешён');db.prepare('SELECT 1').get();return json(res,{ok:true}); }
      if(!allowedHosts.has(req.headers.host)) fail(403,'Недопустимый адрес сайта');
      if(path.startsWith('/api/')) {
        const ip=options.trustProxy||process.env.TELO_TRUST_PROXY==='1'?String(req.headers['x-real-ip']||req.socket.remoteAddress):req.socket.remoteAddress;
        if(!['GET','HEAD'].includes(method)) {
          if(!origins.includes(req.headers.origin)||req.headers['x-telo365']!=='1'||req.headers['sec-fetch-site']==='cross-site') fail(403,'Отклонён запрос с другого сайта');
          rateLimit(db,`writes:${ip}`,400,60000);
        }
        if(method==='GET'&&path==='/api/public') return json(res,{intro:db.prepare('SELECT value FROM settings WHERE key=?').get('intro').value});
        const body=['GET','HEAD'].includes(method)?{}:await readJson(req,path==='/api/nutrition/analyze-photo'?3500000:65536);
        const user=getUser(db,req,cookieName);
        const ctx={db,req,res,path,method,body,user,url,mailer,cookieName,ip,secure:production,trustProxy:options.trustProxy||process.env.TELO_TRUST_PROXY==='1',storeCatalog};
        const publicResult=marketing(ctx);
        if(publicResult) return json(res,publicResult);
        if(path.startsWith('/api/auth/email/')||path==='/api/auth/mail') return json(res,await emailAuth(ctx));
        return json(res,path.startsWith('/api/auth/')||path==='/api/profile'?await accounts(ctx):await journal(ctx));
      }
      if(method!=='GET'&&method!=='HEAD') fail(405,'Метод не разрешён');
      let filename;
      try { filename=resolve(staticDir,'.'+decodeURIComponent(path)); } catch {fail(400,'Некорректный путь');}
      if(!filename.startsWith(staticDir+sep)&&filename!==staticDir) fail(404,'Не найдено');
      if(path.split('/').some(p=>p.startsWith('.')))fail(404,'Не найдено');
      try {if(!statSync(filename).isFile()) filename=resolve(staticDir,'index.html');}catch{if(extname(path))fail(404,'Не найдено');filename=resolve(staticDir,'index.html');}
      if(!realpathSync(filename).startsWith(realpathSync(staticDir)+sep))fail(404,'Не найдено');
      const stat=statSync(filename);res.setHeader('Content-Type',types[extname(filename)]||'application/octet-stream');res.setHeader('Content-Length',stat.size);
      if(path.startsWith('/assets/'))res.setHeader('Cache-Control','public,max-age=31536000,immutable');
      if(path.startsWith('/video/'))res.setHeader('Cache-Control','public,max-age=86400');
      if(method==='HEAD')return res.end();
      createReadStream(filename).on('error',()=>res.destroy()).pipe(res);
    } catch(error) {
      if(!error.status) console.error(JSON.stringify({event:'request_error',code:error.code||'INTERNAL'}));
      if(!res.headersSent)json(res,{error:error.status?error.message:'Не удалось выполнить запрос. Попробуйте ещё раз'},error.status||500);else res.destroy();
    }
  });
  server.requestTimeout=45000;server.headersTimeout=10000;
  server.on('close',()=>db.close());
  return {server,db};
}
function json(res,value,status=200) {res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  process.umask(0o077);
  const {server}=createApplication();const port=Number(process.env.PORT||1435);
  server.listen(port,'127.0.0.1',()=>console.log(`TELO365 server listening on 127.0.0.1:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
}
