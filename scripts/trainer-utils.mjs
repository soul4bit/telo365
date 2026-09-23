import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')
export const avatars=['male','female']

export const parseArgs=(argv=process.argv.slice(2))=>{
  const result={_:[]}
  for(let index=0;index<argv.length;index++){
    const token=argv[index]
    if(!token.startsWith('--')){result._.push(token);continue}
    const [key,inline]=token.slice(2).split('=',2)
    if(inline!==undefined)result[key]=inline
    else if(argv[index+1]&&!argv[index+1].startsWith('--'))result[key]=argv[++index]
    else result[key]=true
  }
  return result
}

export const validExerciseId=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]*$/.test(value)
export const assertExerciseId=value=>{
  if(!validExerciseId(value))throw new Error('exerciseId должен состоять из строчных латинских букв, цифр, _ или - и начинаться с буквы')
  return value
}

export const withinRepo=value=>{
  if(typeof value!=='string'||!value.trim())throw new Error('Ожидался относительный путь внутри репозитория')
  const absolute=resolve(repoRoot,value)
  const rel=relative(repoRoot,absolute)
  if(rel===''||rel.startsWith(`..${sep}`)||rel==='..')throw new Error(`Небезопасный путь: ${value}`)
  return absolute
}
export const toRepoPath=absolute=>relative(repoRoot,absolute).split(sep).join('/')
export const hasFile=async path=>access(path,constants.F_OK).then(()=>true,()=>false)
export const readJson=async path=>JSON.parse(await readFile(path,'utf8'))
export const writeJson=async(path,value)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,`${JSON.stringify(value,null,2)}\n`)}
export const sha256File=async path=>createHash('sha256').update(await readFile(path)).digest('hex')
export const loadGltf=async repoPath=>{
  const absolute=withinRepo(repoPath)
  const source=await readFile(absolute)
  return new Promise((ok,fail)=>new GLTFLoader().parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'',ok,fail))
}
export const charactersManifestPath=withinRepo('trainer/characters.manifest.json')
export const trainerRoot=withinRepo('trainer')
export const readCharactersManifest=()=>readJson(charactersManifestPath)
export const exerciseManifestPath=(root,id)=>resolve(root,'exercises',`${assertExerciseId(id)}.json`)

export const inspectSkinnedModel=gltf=>{
  const meshes=[]
  const nodes=new Map()
  gltf.scene.traverse(node=>{if(node.name)nodes.set(node.name,node);if(node.isSkinnedMesh)meshes.push(node)})
  if(meshes.length!==1)throw new Error(`Ожидался один SkinnedMesh, найдено: ${meshes.length}`)
  const mesh=meshes[0]
  if(!mesh.skeleton)throw new Error('У SkinnedMesh отсутствует skeleton')
  const {skeleton}=mesh
  const joints=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight')
  if(!joints||!weights)throw new Error('У SkinnedMesh отсутствуют skinIndex или skinWeight')
  for(let index=0;index<weights.count;index++){
    const total=weights.getX(index)+weights.getY(index)+weights.getZ(index)+weights.getW(index)
    if(Math.abs(total-1)>1e-3)throw new Error(`Skin weights не нормализованы: вершина ${index}`)
  }
  if(skeleton.boneInverses.length!==skeleton.bones.length||skeleton.boneInverses.some(matrix=>matrix.elements.some(value=>!Number.isFinite(value))))throw new Error('Bind matrices отсутствуют или повреждены')
  const boneSet=new Set(skeleton.bones)
  const parent=bone=>{
    let candidate=bone.parent
    while(candidate&&!boneSet.has(candidate))candidate=candidate.parent
    return candidate?.name||null
  }
  return {
    mesh,
    nodes,
    bones:skeleton.bones,
    hierarchy:Object.fromEntries(skeleton.bones.map(bone=>[bone.name,parent(bone)])),
    triangles:(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,
    vertices:mesh.geometry.getAttribute('position').count
  }
}

export const assertCanonicalModel=async(characters,avatar)=>{
  const character=characters.characters?.[avatar]
  if(!character)throw new Error(`Канонический персонаж ${avatar} не описан`)
  const modelPath=character.modelGlb
  if(!await hasFile(withinRepo(modelPath)))throw new Error(`Не найдена каноническая модель: ${modelPath}`)
  const hash=await sha256File(withinRepo(modelPath))
  if(hash!==character.modelSha256)throw new Error(`Изменился hash канонической ${avatar}-модели. Ранее созданные анимации требуют повторной проверки.`)
  const inspection=inspectSkinnedModel(await loadGltf(modelPath))
  const expected=characters.canonicalBones||[]
  const boneNames=new Set(inspection.bones.map(bone=>bone.name))
  if(inspection.bones.length!==character.boneCount||expected.some(name=>!boneNames.has(name))||boneNames.size!==expected.length)throw new Error(`Канонический ${avatar}-риг не соответствует manifest`)
  for(const [bone,parent] of Object.entries(characters.canonicalHierarchy||{}))if(inspection.hierarchy[bone]!==parent)throw new Error(`Нарушена иерархия ${avatar}-рига: ${bone}`)
  return {...inspection,modelPath,modelSha256:hash}
}

export const collectExercise3dIds=async()=>{
  const source=await readFile(withinRepo('src/exercise3d.ts'),'utf8')
  const body=source.match(/export const exercise3DAssets:Record<string,Exercise3DAsset>=\{([\s\S]*?)\n\}/)?.[1]||''
  return new Set([...body.matchAll(/^\s*(?:'([^']+)'|([a-z][a-z0-9_-]*))\s*:/gm)].map(match=>match[1]||match[2]))
}

const assertLoop=clip=>{
  for(const track of clip.tracks.filter(track=>track.times.length>1)){
    const size=track.getValueSize()
    for(let offset=0;offset<size;offset++)if(Math.abs(track.values[offset]-track.values[track.values.length-size+offset])>1e-5)throw new Error(`Loop boundary отличается: ${track.name}`)
  }
}
const assertQuaternionTracks=clip=>{
  const tracks=clip.tracks.filter(track=>track.name.endsWith('.quaternion'))
  if(!tracks.length)throw new Error('В GLB отсутствуют quaternion rotation tracks')
  for(const track of tracks){
    for(let index=0;index<track.values.length;index+=4){
      const norm=Math.hypot(track.values[index],track.values[index+1],track.values[index+2],track.values[index+3])
      if(Math.abs(norm-1)>.02)throw new Error(`Quaternion не нормализован: ${track.name}`)
    }
  }
  return tracks.length
}

export const verifyAvatarAnimation=async({characters,manifest,avatar})=>{
  const model=await assertCanonicalModel(characters,avatar)
  for(const attachment of manifest.equipment?.attachments||[]){
    if(!attachment.attachBone||!characters.canonicalBones.includes(attachment.attachBone))throw new Error(`Equipment attachment ${attachment.id||'without-id'} must reference a canonical attachBone`)
  }
  const source=manifest.avatars?.[avatar]
  if(!source?.animationGlb)throw new Error(`В manifest отсутствует ${avatar}-анимация`)
  if(!await hasFile(withinRepo(source.animationGlb)))throw new Error(`Не найден animation GLB: ${source.animationGlb}`)
  const animation=await loadGltf(source.animationGlb)
  if(animation.animations.length!==1)throw new Error(`Ожидался один клип в ${source.animationGlb}, найдено: ${animation.animations.length}`)
  const clip=animation.animations[0]
  if(clip.name!==manifest.animation.clip)throw new Error(`Ожидался клип ${manifest.animation.clip}, получен ${clip.name}`)
  const expectedDuration=manifest.animation.durationSeconds
  if(!Number.isFinite(expectedDuration))throw new Error('В manifest не указана фактическая durationSeconds. Зафиксируйте длительность экспортированного clip до проверки.')
  const tolerance=manifest.animation.durationToleranceSeconds??.1
  if(Math.abs(clip.duration-expectedDuration)>tolerance)throw new Error(`Длительность ${clip.duration} c не соответствует manifest (${expectedDuration} c)`)
  const targets=[...new Set(clip.tracks.map(track=>THREE.PropertyBinding.parseTrackName(track.name).nodeName).filter(Boolean))]
  const unknown=targets.filter(target=>!model.nodes.has(target))
  if(unknown.length)throw new Error(`Анимация ссылается на отсутствующие кости: ${unknown.join(', ')}`)
  const nonBoneTargets=targets.filter(target=>!characters.canonicalBones.includes(target))
  if(nonBoneTargets.length)throw new Error(`Анимация содержит root или посторонние треки: ${nonBoneTargets.join(', ')}`)
  const quaternionTracks=assertQuaternionTracks(clip)
  if(manifest.animation.loop)assertLoop(clip)
  const hipsTrack=clip.tracks.find(track=>track.name==='Hips.position')
  if(manifest.animation.requiresHipsTranslation&&!hipsTrack)throw new Error('Для упражнения требуется translation track таза Hips.position')
  const modelForMixer=await loadGltf(model.modelPath)
  const mixerHips=[]
  modelForMixer.scene.traverse(node=>{if(node.name==='Hips')mixerHips.push(node)})
  if(mixerHips.length!==1)throw new Error('У тестовой модели не найдена единственная кость Hips')
  const before=mixerHips[0].position.clone()
  const verifiedMixer=new THREE.AnimationMixer(modelForMixer.scene)
  verifiedMixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play()
  verifiedMixer.update(Math.min(clip.duration/2,2))
  const mixerDelta=mixerHips[0].position.distanceTo(before)
  verifiedMixer.stopAllAction()
  if(manifest.animation.requiresHipsTranslation&&mixerDelta<1e-4)throw new Error('AnimationMixer не изменил положение таза в середине движения')
  return {avatar,model:model.modelPath,animation:source.animationGlb,modelSha256:model.modelSha256,triangles:model.triangles,vertices:model.vertices,bones:model.bones.length,tracks:clip.tracks.length,quaternionTracks,durationSeconds:clip.duration,mixerApplied:true,mixerHipsDelta:Number(mixerDelta.toFixed(5)),loop:manifest.animation.loop?'matching':'not-required'}
}
