import { digest, token, email, password, hashPassword, rateLimit, fail } from './security.mjs';
import { transaction } from './database.mjs';

export async function emailAuth(ctx) {
  const { db, mailer, path, method, body, user, req } = ctx;
  if (path === '/api/auth/mail' && method === 'GET') return { mode: mailer.mode };
  if (method !== 'POST') fail(405, 'Метод не разрешён');
  if (mailer.mode === 'off') fail(503, 'Почта пока не подключена. Используйте резервный код.');
  const ip = ctx.trustProxy ? String(req.headers['x-real-ip'] || req.socket.remoteAddress) : req.socket.remoteAddress;
  rateLimit(db, `mail-ip:${ip}`, 30, 3600000);
  db.prepare('DELETE FROM email_tokens WHERE expires<=?').run(Date.now());
  if (path === '/api/auth/email/request' || path === '/api/auth/email/forgot') {
    const verify = path.endsWith('/request');
    if (verify && !user) fail(401, 'Войдите в аккаунт');
    const address = verify ? user.email : email(body.email);
    rateLimit(db, `mail-send:${address}`, 5, 3600000);
    const target = verify ? user : db.prepare('SELECT * FROM users WHERE email=? AND email_verified=1').get(address);
    if (target && (!verify || !target.email_verified)) {
      const raw = token(), purpose = verify ? 'verify' : 'reset', hashed = digest(raw);
      transaction(db, () => {
        db.prepare('DELETE FROM email_tokens WHERE user_id=? AND purpose=?').run(target.id, purpose);
        db.prepare('INSERT INTO email_tokens VALUES(?,?,?,?,?)').run(hashed, target.id, purpose, address, Date.now() + (verify ? 86400000 : 1800000));
      });
      try { await mailer.send(address, purpose, raw); }
      catch {
        db.prepare('DELETE FROM email_tokens WHERE token=?').run(hashed);
        console.error(JSON.stringify({event:'mail_failed',purpose}));
        if (verify) fail(503, 'Не удалось передать письмо. Попробуйте позже.');
      }
    }
    return { ok:true, mode:mailer.mode, message: verify ? 'Запрос подтверждения принят.' : 'Если подтверждённый адрес есть в системе, письмо будет отправлено.' };
  }
  const purpose = path.endsWith('/verify') ? 'verify' : path.endsWith('/reset') ? 'reset' : null;
  if (!purpose) fail(404, 'Метод не найден');
  if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) fail(400, 'Ссылка недействительна');
  const hashed = digest(body.token);
  const lookup = () => db.prepare('SELECT t.*,u.password,u.email_verified FROM email_tokens t JOIN users u ON u.id=t.user_id WHERE t.token=? AND t.purpose=? AND t.expires>? AND t.email=u.email').get(hashed,purpose,Date.now());
  const row = lookup();
  if (!row) fail(400, 'Ссылка истекла или уже использована');
  if (purpose === 'verify') {
    transaction(db, () => {
      db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(row.user_id);
      db.prepare('DELETE FROM email_tokens WHERE token=?').run(hashed);
    });
    return {ok:true};
  }
  const encoded = await hashPassword(password(body.password)), recoveryCode = token();
  transaction(db, () => {
    const current = lookup();
    if (!current || !current.email_verified || current.password !== row.password) fail(400, 'Ссылка истекла или уже использована');
    db.prepare('UPDATE users SET password=?,recovery=? WHERE id=?').run(encoded,digest(recoveryCode),row.user_id);
    db.prepare('DELETE FROM email_tokens WHERE user_id=?').run(row.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
  });
  return {ok:true,recoveryCode};
}
