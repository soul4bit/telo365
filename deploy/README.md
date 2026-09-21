# TELO365 на отдельной Ubuntu VM

Подготовлено по схеме `../SoulCam/soulcam-desktop/deploy`. 21.09.2026 сайт установлен на ВМ `telo365` (Ubuntu 24.04.3), домен подключён через существующий входной nginx. Текущее состояние: [deployment-status.md](deployment-status.md).
Требования: Ubuntu 24.04+, Python 3.12+, sudo, SSH по ключу. Приложение пока статическое: nginx обслуживает сборку React, Node.js на ВМ не нужен.

## Общий внешний IP с SoulCam

На 21.09.2026 локальная проверка DNS вернула для `telo365.ru` адрес `80.82.48.115`, указанный в документации SoulCam. Локальный DNS для `soulcam.su` возвращает `192.168.1.180`.

```text
Интернет → 80.82.48.115:80/443 → прежний nginx (ВМ SoulCam)
                                ├─ soulcam.su → существующий SoulCam
                                └─ telo365.ru → новая ВМ:8080 → /var/www/telo365/current
```

Пробросы 80/443 на роутерах сохраняются. Дополнительный server_name на входном nginx отправляет TELO365 на новую ВМ. Сертификат TELO365 хранится на входном сервере. Новый origin принимает HTTP только от IP входного nginx и localhost. SSH/UFW скрипты не меняют: сначала проверяется реальное сетевое устройство и доступ по ключу.

1. Закрепить LAN IP новой ВМ в DHCP. Проверить SSH по ключу и `sudo -n true`.
2. Собрать на Windows:

   ```powershell
   npm.cmd ci
   npm.cmd run build
   tar -czf telo365-site.tar.gz dist
   scp telo365-site.tar.gz deploy/install-site.sh USER@NEW_VM_IP:/tmp/
   ```

3. На **новой ВМ** установить сайт (вместо `192.168.1.180` подставить подтверждённый IP входного nginx):

   ```bash
   sudo bash /tmp/install-site.sh /tmp/telo365-site.tar.gz 192.168.1.180
   curl --fail http://127.0.0.1:8080/healthz
   ```

   Если UFW активен, разрешить вход только от входного nginx: `sudo ufw allow from 192.168.1.180 to any port 8080 proto tcp`. SSH в интернет и порт 8080 на роутере не пробрасываются.

4. Передать `enable-domain.sh` на **входную ВМ с nginx**. Сначала проверить доступ с неё к `http://NEW_VM_IP:8080/healthz`, затем:

   ```bash
   sudo bash enable-domain.sh prepare NEW_VM_IP
   ```

5. У регистратора: A `@` → текущий подтверждённый внешний IP; A `www` → тот же IP либо CNAME `www` → `telo365.ru`. Если IPv6 не настроен, убрать ошибочные AAAA. Из внешней сети проверить HTTP обоих имён и доступ к ACME challenge. Локальная DNS-подмена не подтверждает публичную доступность.
6. На входной ВМ после проверки DNS и порта 80:

   ```bash
   sudo bash enable-domain.sh issue NEW_VM_IP
   sudo certbot renew --cert-name telo365.ru --dry-run
   systemctl list-timers certbot.timer
   ```

7. Проверить с мобильного интернета `https://telo365.ru`, перенаправления HTTP и www, затем `https://soulcam.su`. Сертификат получает оба имени, поэтому `www` должен разрешаться до команды issue. Порт 80 нужен для дальнейшего продления.

При необходимости настроить в домашнем DNS `telo365.ru` и `www.telo365.ru` → **входная ВМ**, а не новая ВМ: HTTPS обслуживает входной nginx.

## Обновление и откат

Повторно собрать архив и выполнить `install-site.sh`. Каждая сборка сохраняется в отдельном каталоге `releases/site.*`; `current` переключается атомарно, прежний путь выводится в конце. При ошибке конфигурации или проверки здоровья установщик восстанавливает предыдущую ссылку и nginx-конфигурацию.

Для ручного отката выбрать **реальный предыдущий путь из вывода установщика**, создать новую символическую ссылку `current.next` и заменить ею `current` через `mv -Tf`. Старые релизы автоматически не удаляются. Данные браузера от обновлений файлов не зависят.

`enable-domain.sh` меняет только `/etc/nginx/conf.d/telo365-domain.conf` и собственный renewal hook. Перед реальным запуском сохранить закрытую резервную копию nginx и проверить `nginx -T`, чтобы подтвердить отсутствие конфликтующих доменов. При ошибке `nginx -t` или reload скрипт возвращает прежний конфиг.

Если ВМ имеет **свой отдельный внешний IP**, эта схема не требуется: TLS и статический nginx можно разместить на новой ВМ. Не запускать конфигурацию для общего IP без проверки топологии.

Источники: [nginx proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass), [Certbot webroot и продление](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).
