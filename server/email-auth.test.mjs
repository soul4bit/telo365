import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createApplication } from './app.mjs';
import { createMailer, renderMail } from './mail.mjs';

test('email confirmation and password reset are single-use and revoke sessions',async()=>{
  const letters=[];
  const app=createApplication({dbPath:':memory:',mailer:{mode:'capture',send:async(to,purpose,token)=>letters.push({to,purpose,token})}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const call=(path,body,cookie='',method=body?'POST':'GET')=>new Promise((resolve,reject)=>{
    const text=body?JSON.stringify(body):'';
    const req=request({hostname:'127.0.0.1',port:app.server.address().port,path,method,headers:{Host:'127.0.0.1:5173',Origin:'http://127.0.0.1:5173','X-Telo365':'1','Content-Type':'application/json','Content-Length':Buffer.byteLength(text),Cookie:cookie}},res=>{let data='';res.on('data',b=>data+=b);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(data),cookie:res.headers['set-cookie']?.[0].split(';')[0]}));});req.on('error',reject);req.end(text);
  });
  try {
    const password='Initial long password 2026',email='mail@example.test';
    const reg=await call('/api/auth/register',{email,password,name:'Mail test',accepted:true});
    assert.equal(reg.status,200);const cookie=reg.cookie;assert.equal(letters.length,1);assert.equal(letters[0].purpose,'verify');
    assert.equal((await call('/api/auth/email/request',{})).status,401);
    await call('/api/auth/email/forgot',{email});assert.equal(letters.length,1,'unverified email cannot reset');
    assert.equal((await call('/api/auth/email/request',{},cookie)).status,200);
    const first=letters.at(-1);assert.equal(letters.length,2);assert.equal(first.purpose,'verify');
    assert.notEqual(app.db.prepare('SELECT token FROM email_tokens').get().token,first.token);
    assert.equal((await call('/api/auth/email/verify',{token:first.token},'', 'GET')).status,405);
    assert.equal((await call('/api/auth/email/verify',{token:first.token})).status,200);
    assert.equal((await call('/api/auth/email/verify',{token:first.token})).status,400);
    assert.equal((await call('/api/auth/me',undefined,cookie)).data.user.emailVerified,true);
    const unknown=await call('/api/auth/email/forgot',{email:'missing@example.test'});
    const known=await call('/api/auth/email/forgot',{email});assert.deepEqual(known.data,unknown.data);
    const reset=letters.at(-1),nextPassword='Another long password 2026';
    assert.equal((await call('/api/auth/email/reset',{token:first.token,password:nextPassword})).status,400);
    assert.equal((await call('/api/auth/email/reset',{token:reset.token,password:nextPassword})).status,200);
    assert.equal((await call('/api/auth/email/reset',{token:reset.token,password:nextPassword})).status,400);
    assert.equal((await call('/api/auth/me',undefined,cookie)).data.user,null);
    assert.equal((await call('/api/auth/login',{email,password})).status,401);
    assert.equal((await call('/api/auth/login',{email,password:nextPassword})).status,200);
    const before=letters.length;await call('/api/auth/email/forgot',{email});assert.equal(letters.length,before+1);
    app.db.prepare('UPDATE email_tokens SET expires=0').run();
    assert.equal((await call('/api/auth/email/reset',{token:letters.at(-1).token,password})).status,400);
  }finally{await new Promise(r=>app.server.close(r));}
});

test('mail capture cannot target a remote SMTP server and defaults to disabled',()=>{
  assert.equal(createMailer({}).mode,'off');
  assert.throws(()=>createMailer({MAIL_MODE:'capture',MAIL_HOST:'smtp.example.com',MAIL_PUBLIC_URL:'https://telo365.ru',MAIL_FROM:'no-reply@telo365.ru'}));
  assert.throws(()=>createMailer({MAIL_MODE:'smtp',MAIL_HOST:'smtp.example.com',MAIL_PUBLIC_URL:'https://telo365.ru',MAIL_FROM:'no-reply@telo365.ru'}),/SMTP credentials are required/);
});

test('mail template carries TELO365 styling and one-time action link',()=>{const message=renderMail({origin:new URL('https://telo365.ru'),purpose:'verify',token:'a'.repeat(43)});assert.match(message.html,/TELO365/);assert.match(message.html,/background:#417b32/);assert.match(message.html,/email\/verify#token=/);assert.match(message.text,/\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435/);});
