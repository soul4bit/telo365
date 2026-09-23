import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const canonicalBones=[
  'Hips','Spine','Chest','Neck','Head',
  'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
  'LeftUpperLeg','LeftLowerLeg','LeftFoot','LeftToe','RightUpperLeg','RightLowerLeg','RightFoot','RightToe'
]
const assets={
  male:{base:'public/media/exercises/models/telo-trainer-male-rig-test.glb',visual:'public/media/exercises/models/telo-trainer-male-visual-test.glb',animation:'public/media/exercises/animations/male/squat-test.glb'},
  female:{base:'public/media/exercises/models/telo-trainer-female-rig-test.glb',visual:'public/media/exercises/models/telo-trainer-female-visual-test.glb',animation:'public/media/exercises/animations/female/squat-test.glb'}
}
const load=async path=>{
  const source=await readFile(resolve(path))
  return new Promise((ok,fail)=>new GLTFLoader().parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'',ok,fail))
}
const inspect=async avatar=>{
  const paths=assets[avatar]
  const [base,visual,animation,file]=await Promise.all([load(paths.base),load(paths.visual),load(paths.animation),stat(resolve(paths.visual))])
  const findMeshes=gltf=>{
    const meshes=[]
    gltf.scene.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node)})
    if(!meshes.length)throw new Error(`${avatar}: no SkinnedMesh was found`)
    return meshes[0]
  }
  const baseMesh=findMeshes(base),meshes=[]
  visual.scene.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node)})
  if(meshes.length>6)throw new Error(`${avatar}: visual candidate exceeds the draw-call budget with ${meshes.length} SkinnedMesh primitives`)
  for(const mesh of meshes){
    if(!mesh.skeleton||mesh.skeleton.bones.length!==canonicalBones.length)throw new Error(`${avatar}: visual candidate has an invalid skeleton`)
    const names=mesh.skeleton.bones.map(bone=>bone.name)
    const missing=canonicalBones.filter(name=>!names.includes(name))
    if(missing.length)throw new Error(`${avatar}: visual candidate is missing bones: ${missing.join(', ')}`)
    for(let index=0;index<canonicalBones.length;index++){
      const expected=baseMesh.skeleton.boneInverses[index],actual=mesh.skeleton.boneInverses[index]
      if(expected.elements.some((value,element)=>Math.abs(value-actual.elements[element])>1e-6))throw new Error(`${avatar}: bind matrix changed for ${canonicalBones[index]}`)
    }
    const weights=mesh.geometry.getAttribute('skinWeight')
    if(!weights||!mesh.geometry.getAttribute('skinIndex'))throw new Error(`${avatar}: visual candidate lost skin attributes`)
    for(let index=0;index<weights.count;index++){
      const total=weights.getX(index)+weights.getY(index)+weights.getZ(index)+weights.getW(index)
      if(Math.abs(total-1)>1e-3)throw new Error(`${avatar}: non-normalized exported weight at ${index}`)
    }
  }
  const clip=animation.animations.find(item=>item.name==='squat')
  if(!clip)throw new Error(`${avatar}: existing squat clip is missing`)
  const nodes=new Set()
  visual.scene.traverse(node=>nodes.add(node.name))
  const targets=[...new Set(clip.tracks.map(track=>THREE.PropertyBinding.parseTrackName(track.name).nodeName).filter(Boolean))]
  const unbound=targets.filter(target=>!nodes.has(target))
  if(unbound.length)throw new Error(`${avatar}: existing squat tracks do not bind: ${unbound.join(', ')}`)
  const hips=meshes[0].skeleton.bones.find(bone=>bone.name==='Hips')
  const before=hips.position.clone()
  const mixer=new THREE.AnimationMixer(visual.scene)
  mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play()
  mixer.update(2)
  const hipDelta=hips.position.distanceTo(before)
  mixer.stopAllAction()
  if(hipDelta<1e-4)throw new Error(`${avatar}: AnimationMixer did not move Hips`)
  const materials=[...new Set(meshes.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material.map(item=>item.name):[mesh.material?.name].filter(Boolean)))]
  return {
    avatar,
    visualModel:paths.visual,
    bytes:file.size,
    skinnedMeshes:meshes.length,
    drawCalls:meshes.length,
    triangles:meshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,0),
    vertices:meshes.reduce((sum,mesh)=>sum+mesh.geometry.getAttribute('position').count,0),
    bones:meshes[0].skeleton.bones.length,
    materials,
    bindMatrices:'unchanged from the existing test candidate',
    animation:'existing separate squat-test.glb',
    mixerHipsDelta:Number(hipDelta.toFixed(5)),
  }
}
console.log(JSON.stringify({visualCandidates:await Promise.all(['male','female'].map(inspect)),verified:false,productionChanged:false},null,2))
