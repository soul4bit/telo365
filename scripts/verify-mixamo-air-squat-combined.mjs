import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const candidates={
  male:{
    source:'assets-source/external-characters/mixamo-male/animations/Air Squat.fbx',
    model:'assets-work/mixamo-review/models/mixamo-male-air-squat-combined-test.glb',
    prefix:'mixamorig7', expectedMeshes:7, expectedBones:65,
  },
  female:{
    source:'assets-source/external-characters/mixamo-female/animations/Air Squat Bent Arms.fbx',
    model:'assets-work/mixamo-review/models/mixamo-female-air-squat-combined-test.glb',
    prefix:'mixamorig6', expectedMeshes:7, expectedBones:65,
  },
}

function glbJson(source,path){
  if(source.readUInt32LE(0)!==0x46546c67)throw new Error(`${path}: not a GLB file`)
  const length=source.readUInt32LE(12),type=source.readUInt32LE(16)
  if(type!==0x4e4f534a)throw new Error(`${path}: JSON chunk is missing`)
  return JSON.parse(source.subarray(20,20+length).toString('utf8').replace(/\0+$/,''))
}

// Node has no ImageBitmap decoder. Browser validation below uses the unchanged
// textured file; for structural GLTFLoader parsing only, remove image refs.
function stripTexturesForNodeLoader(source,path){
  const json=glbJson(source,path)
  delete json.images; delete json.textures; delete json.samplers
  for(const material of json.materials??[]){
    if(material.pbrMetallicRoughness){
      delete material.pbrMetallicRoughness.baseColorTexture
      delete material.pbrMetallicRoughness.metallicRoughnessTexture
    }
    delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture; delete material.extensions
  }
  const encoded=Buffer.from(JSON.stringify(json),'utf8')
  const jsonLength=Math.ceil(encoded.length/4)*4
  const sourceJsonLength=source.readUInt32LE(12)
  const header=Buffer.alloc(20+jsonLength)
  header.writeUInt32LE(0x46546c67,0); header.writeUInt32LE(2,4)
  header.writeUInt32LE(header.length+source.length-(20+sourceJsonLength),8)
  header.writeUInt32LE(jsonLength,12); header.writeUInt32LE(0x4e4f534a,16)
  encoded.copy(header,20); header.fill(0x20,20+encoded.length)
  return Buffer.concat([header,source.subarray(20+sourceJsonLength)])
}

async function load(source,path){
  const parsed=stripTexturesForNodeLoader(source,path)
  return new Promise((ok,fail)=>new GLTFLoader().parse(parsed.buffer.slice(parsed.byteOffset,parsed.byteOffset+parsed.byteLength),'',ok,fail))
}

function texturePayload(source,path){
  const json=glbJson(source,path)
  if(!json.images?.length||!json.textures?.length)throw new Error(`${path}: embedded texture payload is missing`)
  if(!json.materials?.some(material=>material.pbrMetallicRoughness?.baseColorTexture))throw new Error(`${path}: material base-color texture is missing`)
  return {images:json.images.length,textures:json.textures.length,materials:json.materials?.length??0}
}

function inspectSkinnedMesh(mesh,path,expectedBones){
  if(!mesh.skeleton||mesh.skeleton.bones.length!==expectedBones)throw new Error(`${path}: expected ${expectedBones}-bone Mixamo skin`)
  const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight')
  if(!indices||!weights)throw new Error(`${path}: skinIndex or skinWeight is missing`)
  if(mesh.skeleton.boneInverses.length!==expectedBones||mesh.skeleton.boneInverses.some(matrix=>matrix.elements.some(value=>!Number.isFinite(value))))throw new Error(`${path}: bind matrices are invalid`)
  for(let index=0;index<weights.count;index++){
    const total=weights.getX(index)+weights.getY(index)+weights.getZ(index)+weights.getW(index)
    if(Math.abs(total-1)>1e-3)throw new Error(`${path}: non-normalized skin weights at vertex ${index}`)
  }
  return {triangles:(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,vertices:mesh.geometry.getAttribute('position').count}
}

function sampleFloor(meshes){
  let floor=Infinity
  const vertex=new THREE.Vector3()
  for(const mesh of meshes){
    const positions=mesh.geometry.getAttribute('position')
    for(let index=0;index<positions.count;index++){
      vertex.fromBufferAttribute(positions,index)
      mesh.applyBoneTransform(index,vertex)
      vertex.applyMatrix4(mesh.matrixWorld)
      floor=Math.min(floor,vertex.y)
    }
  }
  return floor
}

async function verify(avatar,config){
  const [source,file]=await Promise.all([readFile(resolve(config.model)),stat(resolve(config.model))])
  const gltf=await load(source,config.model)
  const payload=texturePayload(source,config.model)
  const meshes=[],nodes=new Map()
  gltf.scene.traverse(node=>{if(node.name)nodes.set(node.name,node);if(node.isSkinnedMesh)meshes.push(node)})
  gltf.scene.updateMatrixWorld(true)
  if(meshes.length!==config.expectedMeshes)throw new Error(`${avatar}: expected ${config.expectedMeshes} SkinnedMesh objects, found ${meshes.length}`)
  const metrics=meshes.map(mesh=>inspectSkinnedMesh(mesh,config.model,config.expectedBones))
  for(const mesh of meshes)for(const bone of mesh.skeleton.bones)nodes.set(bone.name,bone)
  const hipsName=`${config.prefix}Hips`
  if(!nodes.has(hipsName))throw new Error(`${avatar}: ${hipsName} is missing`)
  const clips=gltf.animations.filter(clip=>clip.name==='squat')
  if(clips.length!==1)throw new Error(`${avatar}: expected exactly one in-file squat clip, found ${clips.length}`)
  const clip=clips[0]
  if(clip.duration<2||clip.duration>3)throw new Error(`${avatar}: unexpected original Air Squat duration ${clip.duration}`)
  const targets=[...new Set(clip.tracks.map(track=>THREE.PropertyBinding.parseTrackName(track.name).nodeName).filter(Boolean))]
  const missing=targets.filter(name=>!nodes.has(name))
  if(missing.length)throw new Error(`${avatar}: animation tracks target missing nodes: ${missing.join(', ')}`)
  const loopDifference=Math.max(...clip.tracks.filter(track=>track.times.length>1).map(track=>{
    const size=track.getValueSize(); let result=0
    for(let offset=0;offset<size;offset++)result=Math.max(result,Math.abs(track.values[offset]-track.values[track.values.length-size+offset]))
    return result
  }))
  // The authored source action is preserved without editing terminal keys. The
  // Mixamo source clips return to their standing pose within this small tolerance.
  if(loopDifference>1e-3)throw new Error(`${avatar}: source Air Squat loop boundary differs by ${loopDifference}`)
  const hips=nodes.get(hipsName),initial=hips.getWorldPosition(new THREE.Vector3())
  const mixer=new THREE.AnimationMixer(gltf.scene)
  const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play()
  mixer.setTime(0); gltf.scene.updateMatrixWorld(true); const floorStart=sampleFloor(meshes)
  mixer.setTime(clip.duration/2); gltf.scene.updateMatrixWorld(true); const hipsMid=hips.getWorldPosition(new THREE.Vector3()); const floorMiddle=sampleFloor(meshes)
  mixer.setTime(clip.duration); gltf.scene.updateMatrixWorld(true); const floorEnd=sampleFloor(meshes)
  action.stop(); mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene)
  const floors=[floorStart,floorMiddle,floorEnd]
  const floorRange=Math.max(...floors)-Math.min(...floors)
  if(Math.abs(floorStart)>.03||floorRange>.02)throw new Error(`${avatar}: character is not grounded at Y=0 (start=${floorStart}, range=${floorRange})`)
  const hipsTravel=hipsMid.distanceTo(initial)
  if(hipsTravel<.1)throw new Error(`${avatar}: AnimationMixer did not produce a meaningful hips movement`)
  return {
    avatar,sourceFbx:config.source,model:config.model,bytes:file.size,
    skinnedMeshes:meshes.length,bones:meshes[0].skeleton.bones.length,
    triangles:metrics.reduce((total,item)=>total+item.triangles,0),vertices:metrics.reduce((total,item)=>total+item.vertices,0),
    clip:clip.name,durationSeconds:Number(clip.duration.toFixed(5)),trackCount:clip.tracks.length,trackTargets:targets.length,
    texturePayload:payload,animationMixerHipsTravel:Number(hipsTravel.toFixed(5)),
    floorY:{start:Number(floorStart.toFixed(6)),middle:Number(floorMiddle.toFixed(6)),end:Number(floorEnd.toFixed(6)),range:Number(floorRange.toFixed(6))},
    sourceLoopBoundaryDelta:Number(loopDifference.toFixed(8)),
  }
}

const results=await Promise.all(Object.entries(candidates).map(([avatar,config])=>verify(avatar,config)))
console.log(JSON.stringify({mixamoAirSquatCombinedCandidates:results,verified:false,productionViewerChanged:false,retargeting:'none'},null,2))
