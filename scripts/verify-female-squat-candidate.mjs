import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const canonicalBones=[
  'Hips','Spine','Chest','Neck','Head',
  'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
  'LeftUpperLeg','LeftLowerLeg','LeftFoot','LeftToe','RightUpperLeg','RightLowerLeg','RightFoot','RightToe'
]
const paths={
  male:{model:'public/media/exercises/models/telo-trainer-male-rig-test.glb',animation:'public/media/exercises/animations/male/squat-test.glb'},
  female:{model:'public/media/exercises/models/telo-trainer-female-rig-test.glb',animation:'public/media/exercises/animations/female/squat-test.glb'}
}
const load=async path=>{
  const source=await readFile(resolve(path))
  return new Promise((ok,fail)=>new GLTFLoader().parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'',ok,fail))
}
const finiteMatrix=matrix=>matrix.elements.every(Number.isFinite)
const getParentName=(bone,bones)=>{
  const set=new Set(bones)
  let parent=bone.parent
  while(parent&&!set.has(parent))parent=parent.parent
  return parent?.name||null
}
const inspect=async ({model:modelPath,animation:animationPath})=>{
  const [model,animation]=await Promise.all([load(modelPath),load(animationPath)])
  const meshes=[]
  const nodes=new Map()
  model.scene.traverse(node=>{if(node.name)nodes.set(node.name,node);if(node.isSkinnedMesh)meshes.push(node)})
  if(meshes.length!==1)throw new Error(`${modelPath}: expected one SkinnedMesh, found ${meshes.length}`)
  const mesh=meshes[0]
  const {skeleton}=mesh
  if(!skeleton||skeleton.bones.length!==canonicalBones.length)throw new Error(`${modelPath}: expected ${canonicalBones.length} skeleton bones`)
  const names=skeleton.bones.map(bone=>bone.name)
  const missing=canonicalBones.filter(name=>!names.includes(name))
  if(missing.length)throw new Error(`${modelPath}: missing canonical bones ${missing.join(', ')}`)
  if(skeleton.boneInverses.length!==skeleton.bones.length||skeleton.boneInverses.some(matrix=>!finiteMatrix(matrix)))throw new Error(`${modelPath}: invalid skin bind matrices`)
  const joints=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight')
  if(!joints||!weights)throw new Error(`${modelPath}: skin attributes are absent`)
  for(let index=0;index<weights.count;index++){
    const total=weights.getX(index)+weights.getY(index)+weights.getZ(index)+weights.getW(index)
    if(Math.abs(total-1)>1e-3)throw new Error(`${modelPath}: non-normalized skin weight at vertex ${index}`)
  }
  if(animation.animations.length!==1)throw new Error(`${animationPath}: expected one exported animation, found ${animation.animations.length}`)
  const clips=animation.animations.filter(clip=>clip.name==='squat')
  if(clips.length!==1)throw new Error(`${animationPath}: expected exactly one clip named squat, found ${clips.length}`)
  const clip=clips[0]
  if(clip.duration<3||clip.duration>4.1)throw new Error(`${animationPath}: expected a 3–4 second clip, found ${clip.duration}`)
  const targets=[...new Set(clip.tracks.map(track=>THREE.PropertyBinding.parseTrackName(track.name).nodeName).filter(Boolean))]
  const unbound=targets.filter(target=>!nodes.has(target))
  if(unbound.length)throw new Error(`${animationPath}: animation targets not found on the rig: ${unbound.join(', ')}`)
  const loopTracks=clip.tracks.filter(track=>track.times.length>1)
  for(const track of loopTracks){
    const size=track.getValueSize()
    for(let offset=0;offset<size;offset++)if(Math.abs(track.values[offset]-track.values[track.values.length-size+offset])>1e-5)throw new Error(`${animationPath}: loop boundary differs in ${track.name}`)
  }
  const hips=nodes.get('Hips'),initial=hips.position.clone(),mixer=new THREE.AnimationMixer(model.scene)
  mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();mixer.update(2)
  const hipDelta=hips.position.distanceTo(initial)
  if(hipDelta<1e-4)throw new Error(`${animationPath}: AnimationMixer did not animate the hips`)
  const hierarchy=Object.fromEntries(skeleton.bones.map(bone=>[bone.name,getParentName(bone,skeleton.bones)]))
  const hipTrack=clip.tracks.find(track=>track.name==='Hips.position')
  if(!hipTrack)throw new Error(`${animationPath}: Hips position track is absent`)
  return {modelPath,animationPath,triangles:(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,vertices:mesh.geometry.getAttribute('position').count,bones:skeleton.bones,targets,clip,hipTrack,hierarchy,hipDelta:Number(hipDelta.toFixed(5))}
}

const [male,female]=await Promise.all([inspect(paths.male),inspect(paths.female)])
for(const bone of canonicalBones)if(male.hierarchy[bone]!==female.hierarchy[bone])throw new Error(`Canonical hierarchy mismatch at ${bone}`)
const femaleHipValues=[...female.hipTrack.values]
const maleHipValues=[...male.hipTrack.values]
if(femaleHipValues.length===maleHipValues.length&&femaleHipValues.every((value,index)=>Math.abs(value-maleHipValues[index])<1e-5))throw new Error('Female Hips track is an unmodified copy of the male animation')
console.log(JSON.stringify({
  female:{model:female.modelPath,animation:female.animationPath,triangles:female.triangles,vertices:female.vertices,skinnedMeshes:1,bones:female.bones.length,tracks:female.clip.tracks.length,durationSeconds:female.clip.duration,midpointHipsDelta:female.hipDelta,loopBoundary:'matching'},
  compatibility:{canonicalHierarchy:'matching',separateRetargetedHipTrack:true,bindMatrices:'finite and per-model'},
  maleReference:{model:male.modelPath,animation:male.animationPath,bones:male.bones.length,durationSeconds:male.clip.duration}
},null,2))
