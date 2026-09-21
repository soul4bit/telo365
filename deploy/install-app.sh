#!/usr/bin/env bash
# Upgrade the dedicated TELO365 VM from a static demo to the persistent application.
set -Eeuo pipefail
umask 022
[[ $EUID -eq 0 && $# -eq 2 ]] || { echo 'Usage: sudo bash install-app.sh APP.tar.gz EDGE_IPV4'; exit 1; }
archive=$(realpath "$1")
edge=$2
python3 - "$edge" <<'PY'
import ipaddress,sys
ipaddress.IPv4Address(sys.argv[1])
PY
[[ $(uname -m) == x86_64 && -f "$archive" ]]
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl xz-utils nginx
install -d -m 755 /opt/telo365 /opt/telo365/releases
work=$(mktemp -d /opt/telo365/releases/app.XXXXXXXX)
chmod 755 "$work"
python3 - "$archive" "$work" <<'PY'
import pathlib,sys,tarfile
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    members=archive.getmembers()
    if sum(m.size for m in members)>250_000_000: raise SystemExit('Archive too large')
    for m in members:
        p=pathlib.PurePosixPath(m.name)
        if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0] not in ('dist','server','deploy') or not (m.isfile() or m.isdir()) or m.name.endswith('.local'):
            raise SystemExit('Unsafe archive member')
    archive.extractall(sys.argv[2], members=members, filter='data')
for file in ('dist/index.html','server/app.mjs','deploy/telo365.service'):
    if not (pathlib.Path(sys.argv[2])/file).is_file(): raise SystemExit('Incomplete archive')
PY
find "$work" -type d -exec chmod 755 {} +
find "$work" -type f -exec chmod 644 {} +
if [[ ! -x /opt/telo365/node/bin/node ]]; then
    curl --fail --location --retry 2 --max-time 180 -o "$work/node.tar.xz" https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz
    printf '%s  %s\n' fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6 "$work/node.tar.xz" | sha256sum --check
    install -d -m 755 /opt/telo365/node
    tar -xJf "$work/node.tar.xz" -C /opt/telo365/node --strip-components=1
    rm -f "$work/node.tar.xz"
fi
id telo365 >/dev/null 2>&1 || useradd --system --home-dir /var/lib/telo365 --shell /usr/sbin/nologin telo365
install -d -o telo365 -g telo365 -m 700 /var/lib/telo365 /var/backups/telo365
conf=/etc/nginx/conf.d/telo365-origin.conf
[[ ! -e "$conf" ]] || head -1 "$conf" | grep -Fxq '# Managed TELO365 origin'
previous=$(readlink /opt/telo365/current || true)
[[ ! -e /opt/telo365/current || -L /opt/telo365/current ]]
install -d -m 700 "$work/rollback"
[[ ! -f "$conf" ]] || cp -p "$conf" "$work/rollback/nginx.conf"
for unit in telo365.service telo365-backup.service telo365-backup.timer telo365-monitor.service telo365-monitor.timer; do
    [[ ! -f /etc/systemd/system/$unit ]] || cp -p "/etc/systemd/system/$unit" "$work/rollback/$unit"
done
if [[ -f /var/lib/telo365/telo365.sqlite && -n "$previous" ]]; then
    runuser -u telo365 -- env TELO_DB=/var/lib/telo365/telo365.sqlite TELO_BACKUPS=/var/backups/telo365 /opt/telo365/node/bin/node "$previous/server/admin.mjs" backup
fi
rollback() {
    trap - ERR
    systemctl stop telo365.service || true
    if [[ -n "$previous" ]]; then ln -sfn "$previous" /opt/telo365/current; else rm -f /opt/telo365/current; fi
    if [[ -f "$work/rollback/nginx.conf" ]]; then cp -p "$work/rollback/nginx.conf" "$conf"; else rm -f "$conf"; fi
    for unit in telo365.service telo365-backup.service telo365-backup.timer telo365-monitor.service telo365-monitor.timer; do
        if [[ -f "$work/rollback/$unit" ]]; then cp -p "$work/rollback/$unit" "/etc/systemd/system/$unit"; else systemctl disable --now "$unit" || true; rm -f "/etc/systemd/system/$unit"; fi
    done
    systemctl daemon-reload
    [[ -z "$previous" ]] || systemctl start telo365.service
    nginx -t && systemctl reload nginx
    echo "Application rolled back. Database preserved. Files: $work/rollback" >&2
}
trap rollback ERR
ln -s "$work" /opt/telo365/current.next
mv -Tf /opt/telo365/current.next /opt/telo365/current
for unit in telo365.service telo365-backup.service telo365-backup.timer telo365-monitor.service telo365-monitor.timer; do
    install -m 644 "$work/deploy/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable telo365.service
systemctl restart telo365.service
healthy=0
for attempt in {1..20}; do
    if curl --fail --silent http://127.0.0.1:1435/api/health; then healthy=1; break; fi
    sleep 1
done
[[ $healthy == 1 ]]
cat > "$conf" <<EOF
# Managed TELO365 origin
server {
    listen 8080;
    server_name telo365.ru www.telo365.ru;
    server_tokens off;
    client_max_body_size 64k;
    allow $edge;
    allow 127.0.0.1;
    deny all;
    location / {
        proxy_pass http://127.0.0.1:1435;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$http_x_real_ip;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";
        proxy_read_timeout 30s;
    }
}
EOF
nginx -t
systemctl reload nginx
healthy=0
for attempt in {1..20}; do
    if curl --fail --silent -H 'Host: telo365.ru' http://127.0.0.1:8080/api/public | /opt/telo365/node/bin/node --input-type=module -e 'let body=""; for await (const chunk of process.stdin) body+=chunk; try { const data=JSON.parse(body); if(typeof data.intro!=="string") process.exit(1); } catch { process.exit(1); }'; then healthy=1; break; fi
    sleep 1
done
[[ $healthy == 1 ]]
systemctl enable --now telo365-backup.timer telo365-monitor.timer
systemctl start telo365-backup.service telo365-monitor.service
trap - ERR
echo "TELO365 deployed: $work"
echo "Previous release: ${previous:-static demo}"
echo 'Database: /var/lib/telo365/telo365.sqlite. Backups: /var/backups/telo365 (14 days).'
