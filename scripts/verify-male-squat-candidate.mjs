import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const modelPath='public/media/exercises/models/telo-trainer-male-rig-test.glb'
const animationPath='public/media/exercises/animations/male/squat-test.glb'
const load=async path=>{
  const source=await readFile(resolve(path))
  return new Promise((ok,fail)=>new GLTFLoader().parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'',ok,fail))
}
const model=await load(modelPath)
const animation=await load(animationPath)
const meshes=[]
const nodes=new Map()
model.scene.traverse(node=>{if(node.name)nodes.set(node.name,node);if(node.isSkinnedMesh)meshes.push(node)})
if(meshes.length!==1)throw new Error(`Expected one SkinnedMesh; found ${meshes.length}`)
const mesh=meshes[0]
const joints=mesh.geometry.getAttribute('skinIndex')
const weights=mesh.geometry.getAttribute('skinWeight')
if(!joints||!weights)throw new Error('SkinnedMesh does not contain skinIndex/skinWeight attributes')
const triangles=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3
const weightProblems=[]
for(let index=0;index<weights.count;index++){
  const total=weights.getX(index)+weights.getY(index)+weights.getZ(index)+weights.getW(index)
  if(Math.abs(total-1)>1e-3){weightProblems.push({index,total});if(weightProblems.length===3)break}
}
if(weightProblems.length)throw new Error(`Skin weights are not normalized: ${JSON.stringify(weightProblems)}`)
const clip=animation.animations.find(candidate=>candidate.name==='squat')
if(!clip)throw new Error(`Expected a squat clip; received ${animation.animations.map(item=>item.name).join(', ')||'none'}`)
if(clip.duration<3||clip.duration>4.1)throw new Error(`Expected a 3–4 second clip; received ${clip.duration}`)
const targets=[...new Set(clip.tracks.map(track=>THREE.PropertyBinding.parseTrackName(track.name).nodeName).filter(Boolean))]
const missing=targets.filter(target=>!nodes.has(target))
if(missing.length)throw new Error(`Animation tracks do not bind to test model: ${missing.join(', ')}`)
const root=nodes.get('Hips')
if(!root)throw new Error('Hips bone is absent from test model')
const starting=root.position.clone()
const mixer=new THREE.AnimationMixer(model.scene)
const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1)
action.clampWhenFinished=true
action.play()
mixer.update(2)
const middle=root.position.clone()
if(middle.distanceTo(starting)<1e-4)throw new Error('AnimationMixer did not move the Hips at the squat midpoint')
const loopingTracks=clip.tracks.filter(track=>track.times.length>1)
const discontinuous=loopingTracks.filter(track=>{
  const size=track.getValueSize()
  for(let offset=0;offset<size;offset++)if(Math.abs(track.values[offset]-track.values[track.values.length-size+offset])>1e-5)return true
  return false
})
if(discontinuous.length)throw new Error(`Loop boundary differs on ${discontinuous.length} animation tracks`)
console.log(JSON.stringify({
  model:modelPath,animation:animationPath,triangles,vertices:mesh.geometry.getAttribute('position').count,
  skinnedMeshes:meshes.length,bones:mesh.skeleton.bones.length,tracks:clip.tracks.length,trackTargets:targets,
  durationSeconds:clip.duration,midpointHipsDelta:Number(middle.distanceTo(starting).toFixed(5)),
  rootAtStart:starting.toArray().map(value=>Number(value.toFixed(5))),
  rootAtMidpoint:middle.toArray().map(value=>Number(value.toFixed(5))),
  loopBoundary:'matching'
},null,2))
