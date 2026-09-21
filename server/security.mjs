import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
let hashing = 0;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (status, message) => { throw new HttpError(status, message); };
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export function string(value, label, max=200, min=1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `Проверьте поле «${label}»`);
  return value.trim();
}
export function numeric(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(400, `Проверьте поле «${label}»`);
  return value;
}
export function boolean(value) { if (typeof value !== 'boolean') fail(400,'Ожидается отметка да/нет'); return value ? 1 : 0; }
export function date(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) fail(400,'Укажите корректную дату');
  return value;
}
export function timezone(value) {
  const zone = string(value,'Часовой пояс',80);
  try { new Intl.DateTimeFormat('en',{timeZone:zone}).format(); } catch { fail(400,'Неизвестный часовой пояс'); }
  return zone;
}
export function today(zone) { return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function email(value) { const result=string(value,'Email',254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400,'Укажите email'); return result; }
export function password(value) { if (typeof value !== 'string' || value.length < 12 || value.length > 128) fail(400,'Пароль должен содержать от 12 до 128 символов'); return value; }
export async function hashPassword(value, salt=randomBytes(16).toString('hex')) {
  if (hashing >= 4) fail(503,'Сервер занят. Повторите через несколько секунд');
  hashing++;
  try { const hash=await scrypt(value,salt,64,{N:131072,r:8,p:1,maxmem:160*1024*1024}); return `${salt}:${hash.toString('hex')}`; }
  finally { hashing--; }
}
export async function checkPassword(value, stored) {
  const [salt, hash] = (stored || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const computed=(await hashPassword(value,salt)).split(':')[1];
  return timingSafeEqual(Buffer.from(computed,'hex'),Buffer.from(hash,'hex'));
}
export function rateLimit(db,key,max,windowMs) {
  const now=Date.now();
  db.prepare('DELETE FROM limits WHERE until < ?').run(now);
  db.prepare('INSERT INTO limits(key,hits,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1').run(digest(key),now+windowMs);
  if (db.prepare('SELECT hits FROM limits WHERE key=?').get(digest(key)).hits > max) fail(429,'Слишком много попыток. Попробуйте позже');
}

export async function readJson(req) {
  if (!(req.headers['content-type']||'').startsWith('application/json')) fail(415,'Ожидается JSON');
  let size=0; const chunks=[];
  for await (const chunk of req) { size+=chunk.length; if(size>65536) fail(413,'Запрос слишком большой'); chunks.push(chunk); }
  try { const value=JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || Array.isArray(value) || typeof value!=='object') fail(400,'Ожидается объект'); return value; }
  catch { fail(400,'Некорректный JSON'); }
}
