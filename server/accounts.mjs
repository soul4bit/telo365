import { randomUUID } from 'node:crypto';
import { createHabits, transaction } from './database.mjs';
import { boolean, checkPassword, digest, email, fail, hashPassword, numeric, password, rateLimit, string, timezone, token } from './security.mjs';

export const profile = u => ({id:u.id,email:u.email,emailVerified:!!u.email_verified,name:u.name,goal:u.goal,target:u.target,timezone:u.timezone,calories:u.calories,role:u.role});
export function getUser(db,req,cookieName) {
  const raw=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!raw||raw.length>100) return null;
  return db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND expires>?').get(digest(raw),Date.now())||null;
}
export function setSession(ctx,userId) {
  const raw=token(),expires=Date.now()+30*86400000;
  ctx.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  ctx.db.prepare('DELETE FROM sessions WHERE token IN (SELECT token FROM sessions WHERE user_id=? ORDER BY expires DESC LIMIT -1 OFFSET 9)').run(userId);
  ctx.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(raw),userId,expires);
  ctx.res.setHeader('Set-Cookie',`${ctx.cookieName}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${ctx.secure?'; Secure':''}`);
}
export async function accounts(ctx) {
  const {db,req,res,path,method,body:b,user:u}=ctx;
  const ip=ctx.trustProxy?String(req.headers['x-real-ip']||req.socket.remoteAddress):req.socket.remoteAddress;
  if(method==='GET'&&path==='/api/auth/me') return {user:u?profile(u):null};
  if(method==='POST'&&['/api/auth/register','/api/auth/login','/api/auth/recover'].includes(path)) {
    rateLimit(db,`auth-ip:${ip}`,35,15*60000);
    const address=email(b.email);
    rateLimit(db,`auth-email:${address}`,15,15*60000);
    const pw=password(b.password);
    if(path.endsWith('/register')) {
      rateLimit(db,`register:${ip}`,8,3600000);
      const name=string(b.name,'Имя',60),zone=timezone(b.timezone||'Europe/Moscow');
      if(boolean(b.accepted)!==1) fail(400,'Подтвердите согласие с условиями хранения данных');
      const encoded=await hashPassword(pw),code=token(),id=randomUUID();
      if(db.prepare('SELECT id FROM users WHERE email=?').get(address)) fail(409,'Не удалось создать аккаунт с этим email. Войдите или восстановите доступ');
      transaction(db,()=>{db.prepare('INSERT INTO users(id,email,password,recovery,name,timezone,created) VALUES(?,?,?,?,?,?,?)').run(id,address,encoded,digest(code),name,zone,new Date().toISOString());createHabits(db,id);});
      setSession(ctx,id);
      return {user:profile(db.prepare('SELECT * FROM users WHERE id=?').get(id)),recoveryCode:code};
    }
    const account=db.prepare('SELECT * FROM users WHERE email=?').get(address);
    if(path.endsWith('/login')) {
      if(!await checkPassword(pw,account?.password)||!account||db.prepare('SELECT password FROM users WHERE id=?').get(account.id)?.password!==account.password) fail(401,'Неверный email или пароль');
      setSession(ctx,account.id);return {user:profile(account)};
    }
    const code=string(b.code,'Резервный код',100);
    if(!account||digest(code)!==account.recovery) fail(401,'Email или резервный код не подошёл');
    const encoded=await hashPassword(pw),next=token();
    // Consume the exact recovery code atomically after the asynchronous hash.
    transaction(db,()=>{
      const updated=db.prepare('UPDATE users SET password=?,recovery=? WHERE id=? AND recovery=?').run(encoded,digest(next),account.id,digest(code));
      if(!updated.changes) fail(401,'Резервный код уже использован');
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(account.id);
      db.prepare('DELETE FROM email_tokens WHERE user_id=?').run(account.id);
    });
    setSession(ctx,account.id);return {user:profile(account),recoveryCode:next};
  }
  if(!u) fail(401,'Войдите в аккаунт');
  if(method==='POST'&&path==='/api/auth/logout') {
    const raw=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(ctx.cookieName+'='))?.slice(ctx.cookieName.length+1);
    if(raw) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(raw));
    res.setHeader('Set-Cookie',`${ctx.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${ctx.secure?'; Secure':''}`);return {ok:true};
  }
  if(method==='PUT'&&path==='/api/profile') {
    const goal=string(b.goal,'Цель',30);
    if(!['wellbeing','lose','gain','maintain'].includes(goal)) fail(400,'Выберите цель');
    db.prepare('UPDATE users SET name=?,goal=?,target=?,timezone=?,calories=? WHERE id=?').run(string(b.name,'Имя',60),goal,b.target==null?null:numeric(b.target,'Целевой вес',30,350),timezone(b.timezone),b.calories==null?null:numeric(b.calories,'Калории',500,8000),u.id);
    return {user:profile(db.prepare('SELECT * FROM users WHERE id=?').get(u.id))};
  }
  if(method==='POST'&&['/api/auth/password','/api/auth/recovery-code','/api/auth/delete'].includes(path)) {
    rateLimit(db,`sensitive:${u.id}`,10,15*60000);
    if(!await checkPassword(password(b.password),u.password)) fail(403,'Текущий пароль не подошёл');
    if(path.endsWith('/delete')) {
      db.prepare('DELETE FROM users WHERE id=?').run(u.id);
      res.setHeader('Set-Cookie',`${ctx.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${ctx.secure?'; Secure':''}`);return {ok:true};
    }
    const code=token();
    if(path.endsWith('/password')) {
      const encoded=await hashPassword(password(b.newPassword));
      transaction(db,()=>{db.prepare('UPDATE users SET password=?,recovery=? WHERE id=?').run(encoded,digest(code),u.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);db.prepare('DELETE FROM email_tokens WHERE user_id=?').run(u.id);});
      setSession(ctx,u.id);
    } else db.prepare('UPDATE users SET recovery=? WHERE id=?').run(digest(code),u.id);
    return {recoveryCode:code};
  }
  fail(404,'Метод не найден');
}
