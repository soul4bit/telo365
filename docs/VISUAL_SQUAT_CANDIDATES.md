# Визуальные кандидаты приседания

Это отдельная визуальная проверка исходных male/female test-кандидатов. Она не
подключена к странице тренировок, не меняет опубликованные GLB и не определяет
статус техники упражнения.

## Что содержат кандидаты

`telo-trainer-*-visual-test.glb` создаётся из соответствующей рабочей сцены в
`assets-work/`. На поверхности Human Base Mesh добавлены реальные, отдельные
геометрические острова одежды: топ, низ, оболочки обуви и короткая шапочка
волос. Они получают те же vertex weights, что и соответствующая часть тела,
затем объединяются с телом в один Blender mesh. При экспорте GLB разделяет его
на пять skinned primitives по материалам; это пять draw calls, а не пять разных
персонажей или скелетов.

Материалы — простые PBR base colors без фотографических skin/face/clothing
текстур и без сторонних ассетов. Оболочки обуви и волос пригодны только для
визуального review. Не считать их финальной реалистичной одеждой.

## Воспроизведение

Запустите Vite и откройте `/tools/visual-squat-preview.html`. Это изолированный
экран: можно выбрать мужчину или женщину, повернуть модель, изменить масштаб,
поставить клип на паузу, вернуть камеру и переключить 0.5×/1×. Он использует
неизменённые отдельные `squat-test.glb` для каждого персонажа. Production
viewer при этом не меняется.

## Повторная сборка

```powershell
& 'D:\soft\Blender 5.2\blender.exe' -b assets-work/telo-trainer-male-squat-animation-working.blend -P tools/prepare-visual-squat-candidate.py -- male
& 'D:\soft\Blender 5.2\blender.exe' -b assets-work/telo-trainer-female-squat-animation-working.blend -P tools/prepare-visual-squat-candidate.py -- female
```

Для GIF сначала создайте кадры, затем используйте существующий Windows helper:

```powershell
& 'D:\soft\Blender 5.2\blender.exe' -b assets-work/telo-trainer-male-squat-visual-working.blend -P tools/render-visual-squat-preview.py -- male
./tools/create-squat-preview-gif.ps1 -FrameDirectory artifacts/male-visual-squat-preview-frames -OutputPath artifacts/male-visual-squat-preview.gif
```

Повторите с `female`, заменив имя папки и GIF. Каталог `artifacts/` игнорируется
Git и служит только для ручной оценки.

## Проверка

```bash
npm run verify:visual-squat-candidates
```

Команда сверяет 19 костей, bind matrices, skin indices/weights, привязку треков
неизменённого клипа и фактическое проигрывание через `AnimationMixer`. Она не
оценивает качество деформации или корректность техники, не выставляет
`verified` и не публикует ассеты.
