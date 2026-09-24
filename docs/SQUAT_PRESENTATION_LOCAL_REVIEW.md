# Локальная доработка окна «Техника: Приседания»

Дата: 24.09.2026. Локальная доработка завершена. На этапе её приёмки commit, push, deploy и изменение действующего сайта не выполнялись. Последующим отдельным сообщением владелец разрешил commit, push и выкладку этой видеоверсии; это разрешение не меняет статус специалистской проверки и не допускает публикацию raw GLB/FBX.

## Окружение и кадрирование

Сохранена студия `telo365-functional-studio-v3`: одна планировка, постоянные позиции оборудования и единый свет для мужчины, женщины и всех четырёх камер. Не меняются исходные персонажи Mixamo, их скелеты, материалы одежды, оригинальные клипы или их временной профиль.

В `src/trainer-studio/FunctionalStudio.tsx` уменьшены примерно на 16% две физические надписи `TELO365.RU`, снижен контраст букв, приглушена оранжевая составляющая дерева и фактура штукатурки. Бренд остаётся поверхностью внутри помещения, без HTML/CSS watermark. Геометрия комнаты и позиции источников света прежние.

В `src/squat-technique-review.tsx` четыре камеры приведены к одному горизонтальному радиусу `4.35` и высоте `0.12`. FOV остаётся `28°`, точка прицеливания смещена к `[0, -0.18, 0]`, чтобы дать обуви безопасный отступ снизу. Камера неподвижна в течение цикла; скелет не масштабируется. Основной ракурс — `3/4`.

Фон входит в пиксели WebM/PNG: **requires media re-render — выполнено локально для всей серии**. Перерендерены восемь видео и восемь posters. Команды и параметры приведены в [спецификации рендера](TELO365_FUNCTIONAL_STUDIO_RENDER_SPEC.md). Фактические хеши серии сохранены в `artifacts/squat-release-review/video-release-manifest.json`. Повторный рендер для перечисленных изменений больше не требуется.

Каждый WebM — VP9, `900×900`, 72 кадра за исходные `2.375 с`. Исправлено небольшое удлинение и неравномерность временных меток MediaRecorder: PTS приведены к исходной сетке времени, изображения не перекодируются и кадры не пропускаются. Погрешность квантования временной метки — не более `0.5 мс`. Это исправление контейнера конечного видео, не изменение оригинальной анимации.

## Поведение интерфейса

- `TechniqueVideoViewer` больше не пересоздаётся при смене пола. Выбранные ракурс, скорость и Play/Pause сохраняются при переключении мужчины и женщины.
- При новом открытии модального окна используются `3/4` и `1×`; выбор пола продолжает использовать существующее состояние страницы.
- Если выбранного ракурса нет у другого пола, показывается доступный default либо первый доступный ракурс этого же упражнения. Возврат к прежнему полу восстанавливает желаемый ракурс.
- Переключатели пола и ракурсов строятся из непустых записей metadata. Отсутствие части комбинаций не требует фиктивных файлов.
- При ошибке WebM сохраняются poster, подсказки и возможность выбрать другой доступный ракурс. Если не загрузился и poster, показывается нейтральная заглушка вместо сломанного изображения.
- При `prefers-reduced-motion` сначала показывается poster; запуск возможен вручную. Переключатели остаются доступны.
- Активные скорость и ракурс получили более контрастное состояние и видимый keyboard focus. На мобильных устройствах элементы управления имеют размер для нажатия не менее 44 px, ракурсы переходят в отдельную строку, техника размещается под видео.

Публичный пользовательский режим продолжает использовать конечные WebM/PNG, без raw GLB/FBX. Локальный R3F preview остаётся инструментом подготовки и проверки материалов.

## Доступные материалы и разделение упражнений

| Упражнение | Пол | Ракурсы |
| --- | --- | --- |
| `squat` — «Приседания» | Мужчина | Спереди, сбоку, сзади, 3/4 |
| `squat` — «Приседания» | Женщина | Спереди, сбоку, сзади, 3/4 |
| `box-squat` — «Приседания до скамьи» | Нет Air Squat media | Собственный штатный fallback |

Файлы серии: `public/media/exercises/videos/squat-{male|female}-{front|side|back|three-quarter}.webm` и соответствующие PNG в `public/media/exercises/posters/`. Никакое отсутствующее упражнение не подменяется видео приседаний. ID, связи планов, история и прогресс тренировок не меняются. Подсказки, частые ошибки и safety note остаются в metadata упражнения.

## Проверка границ кадра

Новая проверка `tools/verify-squat-studio-framing.mjs` измеряет проекции фактически деформированных mesh-вершин по всей временной шкале. Проверяются 72 момента × 4 камеры × 2 персонажа, включая начало и конец клипа.

Результат сохранён 24.09.2026 в `artifacts/studio-quality-review/framing-report.json`: **576 выборок прошли**, минимальный отступ до края кадра `6.22%`, предупреждений, ошибок и browser errors нет. Самая близкая к краю точка — нижняя граница мужского персонажа в 3/4. Проверка конечной выборки не гарантирует все возможные промежуточные моменты и не подтверждает правильность техники упражнения.

Повторить при работающем локальном Vite:

```powershell
$env:TELO_DEV_PORT='4175'
node tools/verify-squat-studio-framing.mjs
```

## Приёмка интерфейса и сборки

На конечных локальных файлах прошли:

| Проверка | Результат |
| --- | --- |
| `npm.cmd run build` | TypeScript и Vite — passed; остаётся предупреждение о размере лениво загружаемого 3D chunk |
| `npm.cmd run test:server` | 38/38, включая старые сессии/планы и разделение Air Squat / Box Squat |
| `npm.cmd run verify:public-assets` | Raw GLB/GLTF/FBX отсутствуют в public и dist; тестовые URL локального production-сервера возвращают 404 |
| `npm.cmd run verify:squat-video-release` | 8 видео + 8 posters; хеши, 72 кадра, PTS и длительность совпадают |
| `npm.cmd run verify:mixamo-air-squat-combined` | Оба оригинальных combined GLB прошли; риги и клипы не изменены |
| `node --test tools/webm-frame-timing.test.mjs` | 2/2: реальные восемь WebM, неизменность данных кадров, идемпотентность, отказ при повреждённом контейнере/неверной временной шкале |
| `tools/test-squat-video-release-browser.mjs` | 13/13 сценариев Chromium; без ошибок приложения и запросов raw GLB/FBX |
| `tools/verify-squat-studio-framing.mjs` | 576/576 выборок, минимальный отступ 6.22%; проверены также near/far planes камеры |

Браузерные размеры: desktop `1280×900`, tablet `820×820`, mobile `390×568`, small mobile `320×480`, reduced-motion `390×844`. Это эмуляция устройств в Chromium, не испытание на физических телефонах или Safari. Реальный сервер не проверялся и не менялся.

Для повторения:

```powershell
npm.cmd run build
npm.cmd run test:server
npm.cmd run verify:public-assets
npm.cmd run verify:squat-video-release
npm.cmd run verify:mixamo-air-squat-combined
node --test tools/webm-frame-timing.test.mjs
$env:TELO_DEV_PORT='4175'
node tools/test-squat-video-release-browser.mjs
```

Браузерная приёмка охватила четыре ракурса, оба пола, сохранение ракурса/скорости/паузы, Restart и loop, закрытие/открытие, прокрутку до safety note, reduced motion, отсутствие WebM/poster, неполные и пустые наборы media и отдельный fallback `box-squat`. Проверены реальные playbackRate/currentTime, touch targets не менее 44 px и отсутствие горизонтального scroll. Результаты: `artifacts/squat-release-review/browser-regression-results.json`.

Локальный адрес окна: `http://127.0.0.1:4175/tools/mixamo-squat-technique-dialog-preview.html`. Диагностические варианты `?media=single-angle`, `?media=missing-male-side`, `?media=empty` и `?exercise=box-squat` доступны только на локальной странице preview; они не меняют production metadata.

Контрольные снимки студии сохраняются в `artifacts/studio-quality-review/`: два contact sheet и отдельные кадры стойки/нижней точки четырёх камер размером `1200×1200`. Дату актуального захвата и SHA-256 источников/изображений содержит `capture-manifest.json`.

Итоговые снимки интерфейса: `artifacts/squat-release-review/squat-video-desktop-{male|female}.png`, `squat-video-{tablet|mobile|small-mobile}-{top|bottom}.png`, `squat-video-reduced-motion.png`, `squat-video-fallback-{poster|no-poster}.png`. При захвате отключены только CSS transitions, чтобы активная кнопка не снималась в промежуточном цвете; воспроизведение видео остаётся рабочим.

## Изменённые файлы

- Интерфейс и metadata: `src/components/TechniqueVideoViewer.tsx`, `src/components/Workouts.tsx`, `src/exercise3d.ts`, `src/workspace.css`.
- Локальный preview и студия: `src/mixamo-squat-technique-dialog-preview.tsx`, `src/squat-technique-review.tsx`, `src/trainer-studio/FunctionalStudio.tsx`.
- Рендер/проверки: `tools/create-squat-release-videos.mjs`, `tools/webm-frame-timing.mjs`, `tools/webm-frame-timing.test.mjs`, `tools/verify-squat-studio-framing.mjs`, `tools/test-squat-video-release-browser.mjs`, `scripts/verify-squat-video-release.mjs`, `scripts/verify-no-test-assets-in-dist.mjs`.
- Media: восемь `public/media/exercises/videos/squat-{male|female}-{front|side|back|three-quarter}.webm` и восемь одноимённых PNG в `public/media/exercises/posters/`.
- Документация: этот отчёт, `docs/SQUAT_VIDEO_RELEASE.md`, `docs/TELO365_FUNCTIONAL_STUDIO_RENDER_SPEC.md`.
- Контрольные снимки, source-frames и фактические media manifests обновлены в локальной игнорируемой Git папке `artifacts/`.

Найденные дефекты исправлены: сброс ракурса/скорости/паузы при смене пола, слишком малый нижний отступ в старом кадрировании, недоступный poster fallback при ошибке `<source>`, поведение неполной библиотеки и расхождение временной сетки WebM. Новых регрессий в перечисленных проверках не обнаружено. База данных, логика тренировок и другие упражнения не изменялись.

## Что остаётся pending

`specialistTechniqueReview` остаётся `pending`, `verified` не меняется. Визуальная доработка, проверка кадров, успешный build и автоматические тесты не заменяют фактическое заключение специалиста. Для публикации локальных изменений требуется отдельное согласование выпуска; эта задача не выполняет commit, push, deploy или `trainer:publish`.
