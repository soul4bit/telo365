import { createHash } from 'node:crypto'
import { access, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root=process.cwd()
const mediaRoot=resolve(root,'public','media','exercises')
const reviewManifestPath=resolve(root,'artifacts','squat-release-review','video-release-manifest.json')
const expected={
  male:{video:'videos/squat-male.webm',poster:'posters/squat-male-side.png'},
  female:{video:'videos/squat-female.webm',poster:'posters/squat-female-side.png'}
}

const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex')
const exists=async file=>{await access(file);return file}

const manifest=JSON.parse(await readFile(reviewManifestPath,'utf8'))
if(!/rendered frames, not raw Mixamo GLB/i.test(manifest.purpose||''))throw new Error('Release manifest does not declare rendered-video-only delivery')

const verified={}
for(const [avatar,paths] of Object.entries(expected)){
  const video=await exists(resolve(mediaRoot,paths.video))
  const poster=await exists(resolve(mediaRoot,paths.poster))
  const reviewVideo=await exists(resolve(root,'artifacts','squat-release-review',`squat-${avatar}.webm`))
  const [videoBuffer,videoStats,posterStats]=await Promise.all([readFile(video),stat(video),stat(poster)])
  if(videoStats.size<100_000)throw new Error(`${avatar}: video is implausibly small (${videoStats.size} bytes)`)
  if(posterStats.size<10_000)throw new Error(`${avatar}: poster is implausibly small (${posterStats.size} bytes)`)
  if(!videoBuffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))throw new Error(`${avatar}: ${paths.video} is not an EBML/WebM file`)
  if(paths.video.includes('.glb')||paths.poster.includes('.glb'))throw new Error(`${avatar}: release media must not point to a GLB`)
  const release=manifest.avatars?.[avatar]
  if(!release)throw new Error(`${avatar}: missing from release manifest`)
  const videoSha256=await hash(video),posterSha256=await hash(poster)
  if(release.videoSha256!==videoSha256||release.posterSha256!==posterSha256)throw new Error(`${avatar}: release manifest hashes do not match generated media`)
  if(await hash(reviewVideo)!==videoSha256)throw new Error(`${avatar}: review WebM does not match release media`)
  verified[avatar]={video:paths.video,poster:paths.poster,videoBytes:videoStats.size,posterBytes:posterStats.size,videoSha256,posterSha256}
}

console.log(JSON.stringify({status:'passed',delivery:'rendered-video-only',avatars:verified},null,2))
