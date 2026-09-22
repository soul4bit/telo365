import { createMailer } from './mail.mjs';

const recipient=String(process.argv[2]||process.env.MAIL_USER||'').trim();
if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(recipient))throw new Error('Usage: node server/mail-probe.mjs RECIPIENT_EMAIL');

const mailer=createMailer();
if(mailer.mode!=='smtp')throw new Error('MAIL_MODE must be smtp');
await mailer.send(recipient,'verify','a'.repeat(43));
console.log(JSON.stringify({sent:true,recipient}));
