#!/usr/bin/env bash
# Run on the EXISTING entry nginx VM when TELO365 shares SoulCam's public IP.
set -euo pipefail
umask 022
[[ $EUID -eq 0 && $# -eq 2 ]] || { echo 'Usage: sudo bash enable-domain.sh prepare|issue ORIGIN_IPV4'; exit 1; }
action=$1
origin=$2
python3 - "$origin" "$action" <<'PY'
import ipaddress, sys
ipaddress.IPv4Address(sys.argv[1])
if sys.argv[2] not in ('prepare', 'issue'): raise SystemExit('Invalid action')
PY
systemctl is-active --quiet nginx
curl --fail --silent --max-time 10 "http://$origin:8080/healthz"
conf=/etc/nginx/conf.d/telo365-domain.conf
if [[ -e "$conf" ]] && ! head -1 "$conf" | grep -Fxq '# Managed TELO365 domain'; then
    echo 'Refusing to replace unmanaged configuration'; exit 1
fi
if [[ ! -e "$conf" ]] && nginx -T 2>/dev/null | grep -Eq 'server_name[^;]*telo365\.ru'; then
    echo 'Domain already configured elsewhere; inspect nginx first'; exit 1
fi
install -d -m 755 /var/lib/telo365-acme
if ! command -v certbot >/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq certbot
fi
if [[ "$action" == issue ]]; then
    [[ -f "$conf" ]] || { echo 'Run prepare first, then verify public DNS and ACME HTTP access'; exit 1; }
    certbot certonly --webroot -w /var/lib/telo365-acme --non-interactive \
        --agree-tos --register-unsafely-without-email --cert-name telo365.ru \
        -d telo365.ru -d www.telo365.ru --keep-until-expiring
fi
work=$(mktemp -d /var/lib/telo365-acme/config.XXXXXXXX)
trap 'rm -rf -- "$work"' EXIT
[[ ! -f "$conf" ]] || cp -p "$conf" "$work/previous.conf"
python3 - "$origin" "$work/candidate.conf" <<'PY'
from pathlib import Path
import sys
origin, destination = sys.argv[1:]
live = Path('/etc/letsencrypt/live/telo365.ru')
tls = (live / 'fullchain.pem').exists() and (live / 'privkey.pem').exists()
proxy = f'''proxy_pass http://{origin}:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;'''
http_action = 'return 308 https://telo365.ru$request_uri;' if tls else proxy
config = f'''# Managed TELO365 domain
server {{
    listen 80;
    server_name telo365.ru www.telo365.ru;
    server_tokens off;
    location ^~ /.well-known/acme-challenge/ {{
        root /var/lib/telo365-acme;
        default_type text/plain;
        try_files $uri =404;
    }}
    location / {{ {http_action} }}
}}
'''
if tls:
    config += f'''
server {{
    listen 443 ssl;
    server_name telo365.ru www.telo365.ru;
    ssl_certificate {live}/fullchain.pem;
    ssl_certificate_key {live}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    server_tokens off;
    if ($host = www.telo365.ru) {{ return 308 https://telo365.ru$request_uri; }}
    add_header Strict-Transport-Security "max-age=2592000" always;
    location / {{ {proxy} }}
}}
'''
Path(destination).write_text(config)
PY
install -m 644 "$work/candidate.conf" "$conf"
if ! nginx -t || ! systemctl reload nginx; then
    if [[ -f "$work/previous.conf" ]]; then cp -p "$work/previous.conf" "$conf"; else rm -f "$conf"; fi
    nginx -t && systemctl reload nginx
    exit 1
fi
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/telo365-nginx <<'HOOK'
#!/bin/sh
set -eu
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/telo365-nginx
systemctl enable --now certbot.timer
echo "TELO365 domain configured ($action). Existing SoulCam configuration preserved."
