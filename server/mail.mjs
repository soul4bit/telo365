import nodemailer from 'nodemailer';

// Shared contract with SoulCam: off, local capture, or TLS SMTP delivery.
export function createMailer(env = process.env, brand = 'TELO365') {
  const mode = env.MAIL_MODE || 'off';
  if (!['off', 'capture', 'smtp'].includes(mode)) throw new Error('Invalid MAIL_MODE');
  if (mode === 'off') return { mode, send: async () => { throw new Error('MAIL_DISABLED'); } };
  const origin = new URL(env.MAIL_PUBLIC_URL);
  if (origin.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('MAIL_PUBLIC_URL requires HTTPS');
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('MAIL_PUBLIC_URL must be an origin');
  const host = env.MAIL_HOST || '127.0.0.1', port = Number(env.MAIL_PORT || (mode === 'capture' ? 1025 : 587));
  if (mode === 'capture' && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Capture SMTP requires loopback (use SSH tunnel between VMs)');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MAIL_PORT');
  const from = env.MAIL_FROM;
  if (!from || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) throw new Error('MAIL_FROM must be an email');
  const transport = nodemailer.createTransport({ host, port, secure: mode === 'smtp' && port === 465,
    requireTLS: mode === 'smtp', ignoreTLS: mode === 'capture',
    auth: env.MAIL_USER ? { user: env.MAIL_USER, pass: env.MAIL_PASSWORD } : undefined,
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false });
  return { mode, async send(to, purpose, token) {
    if (!['verify', 'reset'].includes(purpose) || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid mail action');
    const link = `${origin.origin}/email/${purpose}#token=${token}`;
    const title = purpose === 'verify' ? 'Подтверждение почты' : 'Восстановление пароля';
    const text = `${brand}: ${title}\n\nОткройте ссылку и подтвердите действие:\n${link}\n\nСсылка действует ${purpose === 'verify' ? '24 часа' : '30 минут'} и используется один раз. Если вы не запрашивали письмо, ничего делать не нужно.\n${mode === 'capture' ? '\nТестовое письмо: доставка во внешние почтовые ящики отключена.' : ''}`;
    const result = await transport.sendMail({ from: { name: brand, address: from }, to, subject: `${brand} — ${title}`, text,
      headers: { 'X-Project': brand, 'Auto-Submitted': 'auto-generated' } });
    if (!result.accepted?.length || result.rejected?.length) throw new Error('MAIL_NOT_ACCEPTED');
  } };
}
