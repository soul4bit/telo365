import { email, fail, rateLimit, string } from './security.mjs';

const eventNames = new Set(['landing_view', 'nav_start', 'hero_start', 'footer_start', 'preview_demo', 'feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5', 'legal_about', 'legal_privacy', 'legal_terms', 'legal_contacts', 'feedback_sent']);
const day = () => new Date().toISOString().slice(0, 10);

export function marketing(ctx) {
  const { path, method, body, db, ip } = ctx;
  if (method === 'POST' && path === '/api/public/events') {
    if (!eventNames.has(body.event)) fail(400, 'Неизвестное событие');
    rateLimit(db, `marketing-event:${ip}`, 80, 60_000);
    db.prepare('INSERT INTO analytics_daily(day,event,hits) VALUES(?,?,1) ON CONFLICT(day,event) DO UPDATE SET hits=hits+1').run(day(), body.event);
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/public/feedback') {
    rateLimit(db, `marketing-feedback:${ip}`, 5, 24 * 60 * 60 * 1000);
    const name = string(body.name, 'Имя', 80);
    const address = email(body.email);
    const message = string(body.message, 'Сообщение', 2500, 10);
    db.prepare('INSERT INTO feedback(name,email,message,created) VALUES(?,?,?,?)').run(name, address, message, new Date().toISOString());
    return { ok: true };
  }
  return null;
}
