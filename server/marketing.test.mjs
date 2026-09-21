import assert from 'node:assert/strict';
import { request } from 'node:http';
import test from 'node:test';
import { createApplication } from './app.mjs';

test('public feedback and aggregate analytics accept valid website requests only', async () => {
  const app = createApplication({ dbPath: ':memory:', origins: 'http://localhost:5173' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;
  const post = (path, body) => new Promise((resolve, reject) => {
    const text = JSON.stringify(body);
    const req = request({ hostname: '127.0.0.1', port, path, method: 'POST', headers: { Host: 'localhost:5173', Origin: 'http://localhost:5173', 'X-Telo365': '1', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } }, res => {
      let value = ''; res.on('data', part => value += part); res.on('end', () => resolve({ status: res.statusCode, value: JSON.parse(value) }));
    });
    req.on('error', reject); req.end(text);
  });
  try {
    assert.equal((await post('/api/public/events', { event: 'landing_view' })).status, 200);
    assert.equal(app.db.prepare('SELECT hits FROM analytics_daily WHERE event=?').get('landing_view').hits, 1);
    assert.equal((await post('/api/public/feedback', { name: 'Анна', email: 'anna@example.test', message: 'Хочу попробовать сервис.' })).status, 200);
    assert.equal(app.db.prepare('SELECT count(*) AS n FROM feedback').get().n, 1);
    assert.equal((await post('/api/public/events', { event: 'visitor-email' })).status, 400);
    assert.equal((await post('/api/public/feedback', { name: 'Анна', email: 'wrong', message: 'Коротко' })).status, 400);
  } finally { await new Promise(resolve => app.server.close(resolve)); }
});
