import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const root=resolve('.')
const output=join(root,'artifacts','squat-technique-review')
const candidates={
  male:'assets-work/mixamo-review/models/mixamo-male-air-squat-combined-test.glb',
  female:'assets-work/mixamo-review/models/mixamo-female-air-squat-combined-test.glb'
}

function glbJson(source,path){
  if(source.readUInt32LE(0)!==0x46546c67)throw new Error(`${path}: GLB header is missing`)
  const length=source.readUInt32LE(12),type=source.readUInt32LE(16)
  if(type!==0x4e4f534a)throw new Error(`${path}: JSON chunk is missing`)
  return JSON.parse(source.subarray(20,20+length).toString('utf8').replace(/\0+$/,''))
}

// Node does not decode embedded browser textures. Structural phase analysis only
// needs the hierarchy and clips, so preserve their buffers while omitting image refs.
function stripTexturesForNodeLoader(source,path){
  const json=glbJson(source,path)
  delete json.images;delete json.textures;delete json.samplers
  for(const material of json.materials??[]){
    if(material.pbrMetallicRoughness){delete material.pbrMetallicRoughness.baseColorTexture;delete material.pbrMetallicRoughness.metallicRoughnessTexture}
    delete material.normalTexture;delete material.occlusionTexture;delete material.emissiveTexture;delete material.extensions
  }
  const encoded=Buffer.from(JSON.stringify(json),'utf8'),jsonLength=Math.ceil(encoded.length/4)*4,sourceJsonLength=source.readUInt32LE(12)
  const header=Buffer.alloc(20+jsonLength)
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(header.length+source.length-(20+sourceJsonLength),8);header.writeUInt32LE(jsonLength,12);header.writeUInt32LE(0x4e4f534a,16)
  encoded.copy(header,20);header.fill(0x20,20+encoded.length)
  return Buffer.concat([header,source.subarray(20+sourceJsonLength)])
}

async function load(path){
  const source=await readFile(resolve(path)),parsed=stripTexturesForNodeLoader(source,path)
  return new Promise((success,failure)=>new GLTFLoader().parse(parsed.buffer.slice(parsed.byteOffset,parsed.byteOffset+parsed.byteLength),'',success,failure))
}

async function analyse(avatar,path){
  const gltf=await load(path),clip=gltf.animations.find(item=>item.name==='squat')
  if(!clip)throw new Error(`${avatar}: squat clip is absent`)
  let hips
  gltf.scene.traverse(node=>{if(!hips&&node.name.endsWith('Hips'))hips=node})
  if(!hips)throw new Error(`${avatar}: Hips bone is absent`)
  const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play(),point=new THREE.Vector3()
  const measure=time=>{mixer.setTime(time);gltf.scene.updateMatrixWorld(true);hips.getWorldPosition(point);return {time,x:point.x,y:point.y,z:point.z}}
  const samples=Array.from({length:286},(_,index)=>measure(clip.duration*index/285))
  const start=samples[0],bottom=samples.reduce((current,item)=>item.y<current.y?item:current)
  const depth=start.y-bottom.y
  if(depth<=.01)throw new Error(`${avatar}: pelvis vertical travel is too small for a squat review`)
  const before=samples.filter(item=>item.time<=bottom.time),after=samples.filter(item=>item.time>=bottom.time)
  const descentStart=before.find(item=>(start.y-item.y)/depth>=.1)??start
  const half=before.find(item=>(start.y-item.y)/depth>=.5)??bottom
  // The terminal source frame repeats the original standing pose, so it is the
  // only unambiguous "return to standing" control frame.
  const phases={
    standing:start.time,
    'descent-start':descentStart.time,
    'half-squat':half.time,
    bottom:bottom.time,
    'return-to-standing':clip.duration
  }
  action.stop();mixer.stopAllAction();mixer.uncacheRoot(gltf.scene)
  return {source:path,clip:clip.name,durationSeconds:Number(clip.duration.toFixed(6)),sampleRateHz:120,verticalPelvisTravel:Number(depth.toFixed(6)),phases:Object.fromEntries(Object.entries(phases).map(([name,time])=>[name,Number(time.toFixed(6))])),phaseDefinition:{'descent-start':'first 120 Hz sample with 10% of sampled pelvis descent','half-squat':'first 120 Hz sample with 50% of sampled pelvis descent',bottom:'minimum sampled pelvis world Y','return-to-standing':'original terminal frame, which repeats the standing pose'}}
}

await mkdir(output,{recursive:true})
const avatars=Object.fromEntries(await Promise.all(Object.entries(candidates).map(async([avatar,path])=>[avatar,await analyse(avatar,path)])))
const result={generatedBy:'scripts/analyze-mixamo-squat-phases.mjs',fpsForReview:30,avatars}
await writeFile(join(output,'phase-times.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
