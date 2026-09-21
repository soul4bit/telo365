import { resolve, dirname, basename } from 'node:path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, chmodSync, copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase, backupDatabase } from './database.mjs';

process.umask(0o077);
const command=process.argv[2],argument=process.argv[3];
const dbPath=resolve(process.env.TELO_DB||'data/telo365.sqlite');
const backupDir=resolve(process.env.TELO_BACKUPS||'backups');
if(command==='backup') {
  if(!existsSync(dbPath))throw new Error('Database does not exist');
  const db=openDatabase(dbPath);
  try {
    const destination=argument?resolve(argument):resolve(backupDir,`telo365-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
    if(existsSync(destination))throw new Error('Backup destination already exists');
    await backupDatabase(db,destination);
    const check=new DatabaseSync(destination,{readOnly:true});try {if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup integrity check failed');}finally{check.close()}
    console.log(`Verified backup: ${destination}`);
    if(!argument)for(const name of readdirSync(backupDir)) {
      if(!/^telo365-\d{4}-\d{2}-\d{2}T[\d-]+Z\.sqlite$/.test(name))continue;
      const path=resolve(backupDir,name);if(statSync(path).mtimeMs<Date.now()-14*86400000)unlinkSync(path);
    }
  }finally{db.close()}
}else if(command==='verify-backup') {
  if(!argument||!existsSync(argument))throw new Error('Usage: admin.mjs verify-backup PATH');
  const db=new DatabaseSync(resolve(argument),{readOnly:true});
  try {if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Invalid backup');console.log(JSON.stringify({integrity:'ok',version:db.prepare('PRAGMA user_version').get().user_version,users:db.prepare('SELECT count(*) AS n FROM users').get().n}));}finally{db.close()}
}else if(command==='restore-copy') {
  // Restore into a NEW path only. Production replacement is managed by deploy/restore.sh.
  const target=process.argv[4];
  if(!argument||!target||!existsSync(argument)||existsSync(target))throw new Error('Usage: admin.mjs restore-copy BACKUP NEW_PATH (must not exist)');
  const source=new DatabaseSync(resolve(argument),{readOnly:true});
  try {if(source.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Invalid backup');}finally{source.close()}
  mkdirSync(dirname(resolve(target)),{recursive:true,mode:0o700});copyFileSync(resolve(argument),resolve(target));chmodSync(resolve(target),0o600);
  const restored=openDatabase(resolve(target));try{if(restored.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Invalid restored database');}finally{restored.close()}
  console.log(`Restored into new file: ${basename(target)}`);
}else if(command==='promote') {
  if(!argument||!existsSync(dbPath))throw new Error('Usage: admin.mjs promote REGISTERED_EMAIL');
  const db=openDatabase(dbPath);try {const result=db.prepare('UPDATE users SET role=? WHERE email=?').run('admin',argument.trim().toLowerCase());if(!result.changes)throw new Error('Registered account not found');console.log('Administrator role assigned');}finally{db.close()}
}else throw new Error('Commands: backup [PATH], verify-backup PATH, restore-copy BACKUP NEW_PATH, promote EMAIL');
