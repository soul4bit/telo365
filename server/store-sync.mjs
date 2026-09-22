import { openDatabase } from './database.mjs';
import { createStoreCatalog } from './stores/catalog.mjs';

const [provider,...argumentsList]=process.argv.slice(2);
const values=Object.fromEntries(argumentsList.map(argument=>{const [key,value='']=argument.replace(/^--/,'').split('=',2);return [key,value];}));
if(!provider)throw new Error('Usage: node server/store-sync.mjs PROVIDER [--chain=slug] [--store=id]');

const db=openDatabase(process.env.TELO_DB||'data/telo365.sqlite');
try {
  const catalog=createStoreCatalog({db,production:process.env.NODE_ENV==='production'});
  const result=await catalog.sync(provider,{chain:values.chain||undefined,storeId:values.store||undefined});
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if(result.status!=='ready')process.exitCode=2;
} finally { db.close(); }
