# Безопасный релиз «Приседания»

## Выбранный вариант

К релизу подготовлен вариант **B: видеодемонстрация**. В пользовательском окне «Техника: Приседания» можно выбрать «Женщина» или «Мужчина», запустить/поставить на паузу видео, вернуть его к началу и переключить скорость 0.5×/1×. По умолчанию ролик запускается на скорости **1×** в ракурсе **3/4**; дополнительно доступны «Спереди», «Сбоку» и «Сзади». В кадрах есть сдержанный 3D-интерьер зала в палитре TELO365: пол, панели, стойки и гантели; watermark `TELO365.RU` рисуется интерфейсом поверх видео. При `prefers-reduced-motion` показывается poster выбранного ракурса без запуска видео.

Видеофайлы находятся в `public/media/exercises/videos/`, posters — в `public/media/exercises/posters/`. Они являются отрендеренным конечным видео; raw GLB, FBX, кости и ключи анимаций в них не входят.

Вариант **A: интерактивный 3D** остаётся только локальным developer-preview. Его combined GLB находятся в `assets-work/mixamo-review/` и не должны появляться в `public/`, `dist/` или на публичном origin до отдельного письменного подтверждения допустимого способа доставки.

Причина разделения: [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) описывает royalty-free использование персонажей и анимаций, а [Adobe General Terms of Use](https://www.adobe.com/legal/terms.html?internal_browser=true) разрешают встраивать Content Files в конечный продукт, но запрещают их standalone-распространение. Обычный публичный URL к извлекаемому GLB нельзя считать безопасно одобренной формой встраивания без отдельного письменного подтверждения.

## Условия выпуска

До деплоя нужны два ручных решения:

1. Визуальная и техническая проверка зафиксирована в `artifacts/mixamo-air-squat-specialist-review/VISUAL_TECHNICAL_REVIEW_2026-09-24.md`. Специалист заполняет и подписывает `artifacts/mixamo-air-squat-specialist-review/SPECIALIST_REVIEW.md`; до этого `specialistTechniqueReview` остаётся `pending`.
2. Владелец продукта явно одобряет выпуск варианта B. Это не меняет статус raw GLB и не разрешает их раздачу.

Статус варианта записан в `trainer/squat-video-release.manifest.json`. Автотесты не меняют `verified`, `visualReview` или `specialistTechniqueReview`.

## Локальная проверка перед релизом

```powershell
npm.cmd run generate:squat-release-videos
npm.cmd run verify:squat-video-release
npm.cmd run build
npm.cmd run test:server
npm.cmd run verify:public-assets
npm.cmd run verify:mixamo-air-squat-combined
```

После `npm.cmd run build` убедитесь, что в `dist/media/exercises/videos/` есть восемь файлов `squat-{male|female}-{front|side|back|three-quarter}.webm`, а команда ниже не выводит путей:

```powershell
rg --files dist | rg 'mixamo-.*-air-squat-combined-test\.glb'
```

## Очистка старых тестовых GLB на сервере

Локальная сборка не удаляет то, что уже было разложено на сервере. Перед очисткой выполните только dry-run:

```bash
scp deploy/telo365-cleanup-mixamo-test-assets telo365:/home/max/
ssh telo365 'sudo install -o root -g root -m 0750 /home/max/telo365-cleanup-mixamo-test-assets /usr/local/sbin/telo365-cleanup-mixamo-test-assets'
sudo /usr/local/sbin/telo365-cleanup-mixamo-test-assets --dry-run
```

Проверьте список: скрипт допускает удаление только двух файлов `mixamo-*-air-squat-combined-test.glb` в `*/dist/media/exercises/models/` внутри `/opt/telo365/releases`. Он не затрагивает SQLite, пользовательские файлы, другие упражнения или активный код.

После отдельного разрешения выполнить очистку:

```bash
sudo /usr/local/sbin/telo365-cleanup-mixamo-test-assets --confirm --public-base https://telo365.ru
```

Команда завершается ошибкой, если хотя бы один старый публичный URL продолжает отвечать HTTP 200. Это означает, что нужно проверить CDN/proxy-кэш или другую раздающую директорию; не следует считать очистку завершённой по одному только локальному `dist`.

Проверка 24 сентября 2026 года зафиксирована в `artifacts/squat-release-review/public-origin-audit-2026-09-24.json`: оба старых raw GLB в тот момент отвечали HTTP 200, а новые WebM — HTTP 404, так как видеорелиз ещё не развёрнут.

## Развёртывание после согласования

Соберите архив по принятому server-runbook, передайте его на сервер и только после явного разрешения владельца выполните `sudo telo365-deploy`. Команда деплоя создаёт SQLite backup и использует атомарное переключение symlink.

После деплоя проверить:

```bash
curl -I https://telo365.ru/media/exercises/videos/squat-male-side.webm
curl -I https://telo365.ru/media/exercises/videos/squat-female-side.webm
curl -I https://telo365.ru/media/exercises/models/mixamo-male-air-squat-combined-test.glb
curl -I https://telo365.ru/media/exercises/models/mixamo-female-air-squat-combined-test.glb
```

Проверенные WebM должны отвечать HTTP 200, два test GLB — не HTTP 200. Затем откройте «Тренировки → Техника: Приседания», проверьте выбор персонажа, четыре ракурса, watermark, controls, reduced motion, mobile-прокрутку и fallback при недоступном WebM.

## Откат

Сначала определите предыдущий релиз и вручную подставьте его полный проверенный путь:

```bash
readlink -f /opt/telo365/current
find /opt/telo365/releases -maxdepth 1 -type d -name 'app.*' -printf '%T@ %p\n' | sort -nr
PREVIOUS_RELEASE='<полный путь к предыдущему app.*>'
sudo ln -s "$PREVIOUS_RELEASE" /opt/telo365/current.next
sudo mv -Tf /opt/telo365/current.next /opt/telo365/current
sudo systemctl restart telo365.service
```

После отката повторите HTTP-проверку сайта и убедитесь, что health check сервиса проходит. Не удаляйте новую версию, пока откат не подтверждён.
