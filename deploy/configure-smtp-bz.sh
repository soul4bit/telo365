#!/usr/bin/env bash
set -Eeuo pipefail

read -r -s -p 'SMTP.BZ password: ' smtp_password
printf '\n'
[[ -n "$smtp_password" && "$smtp_password" != *$'\n'* ]] || { echo 'Password is required.' >&2; exit 1; }

sudo install -d -m 700 /etc/telo365
sudo tee /etc/telo365/mail.env >/dev/null <<EOF
MAIL_MODE=smtp
MAIL_HOST=connect.smtp.bz
MAIL_PORT=587
MAIL_PUBLIC_URL=https://telo365.ru
MAIL_FROM=no-reply@telo365.ru
MAIL_USER=soulbit82@gmail.com
MAIL_PASSWORD=$smtp_password
EOF
unset smtp_password
sudo chmod 600 /etc/telo365/mail.env
sudo /usr/local/sbin/telo365-admin restart
sleep 2
curl --fail --silent http://127.0.0.1:1435/api/health
echo
sudo bash -c 'set -a; . /etc/telo365/mail.env; set +a; exec /opt/telo365/node/bin/node /opt/telo365/current/server/mail-probe.mjs "$MAIL_USER"'
echo 'SMTP.BZ is configured. A verification-style test message was sent to MAIL_USER.'
