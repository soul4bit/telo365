import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const clips=['squat','pushup','plank','dumbbell_row','shoulder_press']
const trainers=[
  {id:'male',model:'public/media/exercises/models/telo-trainer-male.glb',animations:'public/media/exercises/animations/male'},
  {id:'female',model:'public/media/exercises/models/telo-trainer-female.glb',animations:'public/media/exercises/animations/female'}
]
const loader=new GLTFLoader()
const issues=[]

const exists=async path=>access(resolve(path)).then(()=>true).catch(()=>false)
const loadGlb=async path=>{
  const source=await readFile(resolve(path))
  return new Promise((resolveGltf,reject)=>loader.parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'',resolveGltf,reject))
}
const numberList=values=>values.map(value=>Number(value.toFixed(5))).join(', ')

function inspectRig(scene){
  scene.updateMatrixWorld(true)
  const skinnedMeshes=[]
  const nodes=new Set()
  scene.traverse(node=>{if(node.name)nodes.add(node.name);if((node).isSkinnedMesh)skinnedMeshes.push(node)})
  const skeletons=skinnedMeshes.map(mesh=>mesh.skeleton)
  const bones=skeletons.flatMap(skeleton=>skeleton.bones)
  return {skinnedMeshes,nodes,bones}
}

function reportRig(id,rig){
  if(!rig.skinnedMeshes.length){issues.push(`${id}: no SkinnedMesh was found`);return}
  if(!rig.bones.length)issues.push(`${id}: SkinnedMesh has no bones`)
  console.log(`${id}: ${rig.skinnedMeshes.length} SkinnedMesh, ${rig.bones.length} bone references`)
  for(const [index,mesh] of rig.skinnedMeshes.entries()){
    const skeleton=mesh.skeleton
    if(skeleton.bones.length!==skeleton.boneInverses.length)issues.push(`${id}: skin ${index} has inconsistent bone inverses`)
    if(mesh.bindMatrix.determinant()===0)issues.push(`${id}: skin ${index} has a singular bind matrix`)
  }
}

function compareRigs(left,right){
  const leftBones=new Map(left.bones.map(bone=>[bone.name,bone]))
  const rightBones=new Map(right.bones.map(bone=>[bone.name,bone]))
  const missingFromFemale=[...leftBones.keys()].filter(name=>!rightBones.has(name))
  const missingFromMale=[...rightBones.keys()].filter(name=>!leftBones.has(name))
  if(missingFromFemale.length||missingFromMale.length){
    issues.push(`male/female rigs use different bone sets (male-only: ${missingFromFemale.join(', ')||'none'}; female-only: ${missingFromMale.join(', ')||'none'})`)
    return
  }
  const restDifferences=[]
  for(const [name,maleBone] of leftBones){
    const femaleBone=rightBones.get(name)
    if(!maleBone.position.equals(femaleBone.position)||!maleBone.quaternion.equals(femaleBone.quaternion)||!maleBone.scale.equals(femaleBone.scale))restDifferences.push(name)
  }
  console.log(`male/female rig names match (${leftBones.size} bones).${restDifferences.length?` Rest transforms differ for ${restDifferences.length} bones; keep per-avatar retargeted clips.`:' Rest transforms match.'}`)
}

function checkAnimation(id,rig,clipName,gltf){
  const clip=gltf.animations.find(item=>item.name===clipName)
  if(!clip){issues.push(`${id}/${clipName}: expected AnimationClip named "${clipName}"`);return}
  const targets=[...new Set(clip.tracks.flatMap(track=>{
    try{return [THREE.PropertyBinding.parseTrackName(track.name).nodeName]}catch{return []}
  }).filter(Boolean))]
  const missing=targets.filter(target=>!rig.nodes.has(target))
  if(missing.length)issues.push(`${id}/${clipName}: tracks do not bind to this model (${missing.join(', ')})`)
  console.log(`${id}/${clipName}: ${clip.tracks.length} tracks, ${targets.length} targets${missing.length?`; missing ${missing.join(', ')}`:''}`)
}

const loaded=[]
for(const trainer of trainers){
  if(!await exists(trainer.model)){issues.push(`${trainer.id}: missing ${trainer.model}`);continue}
  try{
    const model=await loadGlb(trainer.model)
    const rig=inspectRig(model.scene)
    reportRig(trainer.id,rig)
    loaded.push({id:trainer.id,rig})
    for(const clipName of clips){
      const animationPath=`${trainer.animations}/${clipName}.glb`
      if(!await exists(animationPath)){issues.push(`${trainer.id}/${clipName}: missing ${animationPath}`);continue}
      try{checkAnimation(trainer.id,rig,clipName,await loadGlb(animationPath))}catch(error){issues.push(`${trainer.id}/${clipName}: ${error instanceof Error?error.message:String(error)}`)}
    }
  }catch(error){issues.push(`${trainer.id}: ${error instanceof Error?error.message:String(error)}`)}
}
if(loaded.length===2)compareRigs(loaded[0].rig,loaded[1].rig)

if(issues.length){
  console.error('\nTrainer asset verification failed:')
  for(const issue of issues)console.error(`- ${issue}`)
  process.exitCode=1
}else{
  console.log('\nStructural verification passed. Inspect both models and every motion visually before marking verifiedClips in src/exercise3d.ts.')
}
