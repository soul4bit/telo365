import { readJson, parseArgs, readCharactersManifest, trainerRoot, exerciseManifestPath, verifyAvatarAnimation, writeJson } from './trainer-utils.mjs'

const args=parseArgs()
if(!args.exercise)throw new Error('Использование: npm run trainer:publish -- --exercise squat --approve --apply')
if(args.approve!==true||args.apply!==true)throw new Error('Публикация требует явных флагов --approve и --apply. Эта команда не включает упражнение в production viewer автоматически.')
const path=exerciseManifestPath(trainerRoot,args.exercise)
const manifest=await readJson(path)
const failures=[]
if(manifest.reviews?.technical!=='passed')failures.push('техническая совместимость')
if(manifest.reviews?.visual!=='passed')failures.push('визуальная проверка')
if(manifest.reviews?.specialistTechnique!=='passed')failures.push('проверка техники специалистом')
if(Object.values(manifest.avatars||{}).some(avatar=>avatar.technicalStatus!=='passed'))failures.push('отдельные технические статусы обоих персонажей')
if(failures.length)throw new Error(`Публикация ${manifest.exerciseId} запрещена: отсутствуют ${failures.join(', ')}.`)
const characters=await readCharactersManifest()
for(const avatar of ['male','female'])await verifyAvatarAnimation({characters,manifest,avatar})
manifest.reviews.readyForPublication=true
manifest.publication={state:'approved-for-manual-integration',approvedByUser:true,approvedAt:new Date().toISOString()}
await writeJson(path,manifest)
console.log(JSON.stringify({exerciseId:manifest.exerciseId,publication:manifest.publication,productionViewerChanged:false,nextStep:'Вручную подключите упражнение к production viewer отдельным проверяемым изменением.'},null,2))
