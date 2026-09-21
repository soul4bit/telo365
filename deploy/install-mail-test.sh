#!/usr/bin/env bash
# Two local-only SMTP capture instances. No outbound relay, no DNS changes.
set -euo pipefail
[[ $EUID -eq 0 && $# -eq 1 ]] || { echo 'Usage: sudo bash install-mail-test.sh MAILPIT_ARCHIVE'; exit 1; }
archive=$(realpath "$1")
printf '%s  %s\n' 397a14cad03ae34d7c5f13215fd24971fed5ce48bf4237554829b0a10d4306ad "$archive" | sha256sum --check
work=$(mktemp -d)
trap 'rm -f "$work/mailpit"; rmdir "$work"' EXIT
tar -xzf "$archive" -C "$work" mailpit
install -d -m 755 /opt/mailpit /etc/mailpit
install -m 755 "$work/mailpit" /opt/mailpit/mailpit
cat > /etc/systemd/system/mailpit@.service <<'EOF'
[Unit]
Description=Mailpit test inbox for %i
After=network.target

[Service]
DynamicUser=yes
StateDirectory=mailpit-%i
StateDirectoryMode=0700
EnvironmentFile=/etc/mailpit/%i.env
ExecStart=/opt/mailpit/mailpit --database /var/lib/mailpit-%i/messages.sqlite --max 500 --max-age 7d --max-message-size 2 --disable-version-check --smtp-disable-rdns --block-remote-css-and-fonts --allowed-hosts localhost,127.0.0.1
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
MemoryMax=256M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF
for project in telo365 soulcam; do
    if [[ $project == telo365 ]]; then smtp=1025; ui=8025; else smtp=1026; ui=8026; fi
    printf 'MP_LABEL=%s-test\nMP_SMTP_BIND_ADDR=127.0.0.1:%s\nMP_UI_BIND_ADDR=127.0.0.1:%s\n' "$project" "$smtp" "$ui" > "/etc/mailpit/$project.env"
    chmod 644 "/etc/mailpit/$project.env"
done
systemctl daemon-reload
systemctl enable --now mailpit@telo365 mailpit@soulcam
curl --retry 10 --retry-delay 1 --retry-connrefused --fail --silent --output /dev/null http://127.0.0.1:8025/livez
curl --retry 10 --retry-delay 1 --retry-connrefused --fail --silent --output /dev/null http://127.0.0.1:8026/livez
echo 'Mail capture ready: TELO365 1025/8025; SoulCam 1026/8026. Loopback only, relay disabled.'
