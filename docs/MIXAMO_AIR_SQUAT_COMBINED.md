# Оригинальные кандидаты Mixamo Air Squat

Это изолированная проверка двух FBX, которые были скачаны с опцией **With Skin**. Она не изменяет production viewer, `src/exercise3d.ts`, канонические manifests и статусы `verified`.

| Персонаж | Исходный FBX | Combined GLB |
| --- | --- | --- |
| CH08_NONPBR | `assets-source/external-characters/mixamo-male/animations/Air Squat.fbx` | `assets-work/mixamo-review/models/mixamo-male-air-squat-combined-test.glb` |
| Jody | `assets-source/external-characters/mixamo-female/animations/Air Squat Bent Arms.fbx` | `assets-work/mixamo-review/models/mixamo-female-air-squat-combined-test.glb` |

Каждый combined GLB содержит геометрию, оригинальные материалы и текстуры, 65-костный Mixamo-скелет, skin weights и единственный клип `squat`. Анимация экспортирована из того же FBX, что и персонаж: старые 19-костные клипы TELO365 и retargeting не используются.

## Повторный экспорт

```powershell
& 'D:\soft\Blender 5.2\blender.exe' -b -P tools/prepare-mixamo-air-squat-combined.py -- male
& 'D:\soft\Blender 5.2\blender.exe' -b -P tools/prepare-mixamo-air-squat-combined.py -- female
```

Исходные FBX не изменяются. В рабочих копиях их embedded-текстуры уменьшаются до 1024 px только для web-review GLB.

## Проверка

Открыть `http://127.0.0.1:4174/tools/mixamo-air-squat-preview.html` при запущенном Vite. Preview загружает `modelUrl` и `animationUrl` из одного combined GLB. Он остаётся отдельным от страницы тренировок.

```powershell
npm.cmd run verify:mixamo-air-squat-combined
node tools/test-mixamo-air-squat-preview-browser.mjs
```

Контрольные изображения и GIF создаются отдельно в `artifacts/mixamo-air-squat-*/`; они не входят в web bundle. Автоматические проверки подтверждают структуру и совместимость, но не подтверждают технику приседа специалистом.
