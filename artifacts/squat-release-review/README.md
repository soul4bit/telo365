# Приседания: пакет видеорелиза

Этот каталог содержит материалы для пользовательского и специалистского согласования варианта **B — отрендеренная видеодемонстрация**. В него не входят FBX, GLB, скелеты, skin weights или анимационные треки Mixamo.

## Состав

- `video-release-manifest.json` — размеры, хеши, частота кадров и происхождение итоговых видео.
- `squat-male.webm`, `squat-female.webm` — полные циклы для просмотра и согласования; это точные копии кандидатных release-видео.
- `public-origin-audit-2026-09-24.json` — факт проверки действующего origin: новый видеорелиз ещё не разложен, а два старых test GLB всё ещё отвечают HTTP 200 и требуют отдельной серверной очистки.
- `squat-video-desktop-male.png` — пользовательское окно техники на desktop.
- `squat-video-mobile-bottom.png` — нижняя часть того же окна после прокрутки на mobile.
- В публичной сборке, после разрешённого деплоя: `public/media/exercises/videos/squat-male.webm`, `squat-female.webm` и их poster-изображения.

Видео собраны локально из контрольных кадров из `artifacts/squat-technique-review/`. Это исходный цикл Air Squat, отрендеренный для review ранее; при создании WebM не менялись скелеты, GLB, FBX, ключи и тайминг анимации.

## Статусы

- Техническая совместимость исходных combined GLB: пройдена — см. `trainer/mixamo-air-squat-combined.manifest.json`.
- Визуальная и техническая проверка: **пройдена** — см. `artifacts/mixamo-air-squat-specialist-review/VISUAL_TECHNICAL_REVIEW_2026-09-24.md`.
- Специалистское заключение по технике: **pending**.
- `verified`: **false**.
- Публичная раздача raw Mixamo GLB: **не одобрена**.

Перед выпуском специалист должен заполнить `artifacts/mixamo-air-squat-specialist-review/SPECIALIST_REVIEW.md` на основе полного пакета `artifacts/squat-technique-review/` и диагностики `artifacts/squat-technique-diagnostics/`.
