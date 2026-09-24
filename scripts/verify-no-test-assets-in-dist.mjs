import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { request } from 'node:http'
import { join, resolve } from 'node:path'
import { createApplication } from '../server/app.mjs'

const root=resolve('.')
const publicDir=join(root,'public')
const distDir=join(root,'dist')
const testAsset=/mixamo.*(?:test|air-squat).*\.(?:glb|gltf|fbx)$/i

async function files(directory){
  const items=await readdir(directory,{withFileTypes:true})
  const nested=await Promise.all(items.map(item=>item.isDirectory()?files(join(directory,item.name)):item.isFile()?[join(directory,item.name)]:[]))
  return nested.flat()
}

async function assertNoPublicTestAssets(directory){
  const found=(await files(directory)).filter(path=>testAsset.test(path.replace(/\\/g,'/')))
  assert.deepEqual(found,[],`Unpublished Mixamo source asset leaked into ${directory}: ${found.join(', ')}`)
}

async function assertNoPublicRawModels(directory){
  const found=(await files(directory)).filter(path=>/\.(?:glb|gltf|fbx)$/i.test(path))
  assert.deepEqual(found,[],`Video-only release must not ship raw GLB/GLTF/FBX in ${directory}: ${found.join(', ')}`)
}

function fetchStatus(port,path){
  return new Promise((resolveRequest,reject)=>{
    const req=request({host:'127.0.0.1',port,path,headers:{Host:'localhost:5173'}},response=>{
      response.resume();response.on('end',()=>resolveRequest(response.statusCode))
    })
    req.on('error',reject);req.end()
  })
}

await stat(distDir)
await assertNoPublicTestAssets(publicDir)
await assertNoPublicTestAssets(distDir)
await assertNoPublicRawModels(publicDir)
await assertNoPublicRawModels(distDir)

const resolver=await readFile(join(root,'src','exercise3d.ts'),'utf8')
assert.doesNotMatch(resolver,/\/media\/exercises\/(?:models|animations)\/mixamo[^'"`\s]*/i,'The normal exercise resolver still exposes a public Mixamo test URL')

const app=createApplication({dbPath:':memory:',staticDir:distDir,origins:'http://localhost:5173'})
await new Promise(resolveListen=>app.server.listen(0,'127.0.0.1',resolveListen))
try{
  const port=app.server.address().port
  for(const path of [
    '/media/exercises/models/mixamo-male-air-squat-combined-test.glb',
    '/media/exercises/models/mixamo-female-air-squat-combined-test.glb',
    '/__telo365-local-review-assets/models/mixamo-male-air-squat-combined-test.glb'
  ])assert.equal(await fetchStatus(port,path),404,`Production static server exposes ${path}`)
}finally{await new Promise(resolveClose=>app.server.close(resolveClose))}

console.log(JSON.stringify({publicMixamoTestGlb:false,distMixamoTestGlb:false,publicExerciseGlb:false,distExerciseGlb:false,publicRawGlbGltfFbx:false,distRawGlbGltfFbx:false,productionStaticUrlsReturn404:true},null,2))
