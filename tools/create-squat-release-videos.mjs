/*
 * Produces distributable WebM demonstrations from the local, rendered review
 * frames. It never reads, moves, or publishes FBX/GLB assets.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const root=resolve('.')
const fps=30.25
const frameCount=72
const sourceRoot=resolve(root,'artifacts','squat-technique-review')
const publicRoot=resolve(root,'public','media','exercises')
const reviewRoot=resolve(root,'artifacts','squat-release-review')
const avatars={
  male:{label:'Мужчина',source:'male',video:'videos/squat-male.webm',poster:'posters/squat-male-side.png'},
  female:{label:'Женщина',source:'female',video:'videos/squat-female.webm',poster:'posters/squat-female-side.png'}
}

const digest=async path=>createHash('sha256').update(await readFile(path)).digest('hex')
const dataUrl=async path=>`data:image/png;base64,${(await readFile(path)).toString('base64')}`

async function renderVideo(page,frames){
  return page.evaluate(async ({frames,fps})=>{
    const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds))
    const load=source=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Cannot load ${source}`));image.src=source})
    const images=await Promise.all(frames.map(load))
    const width=images[0].naturalWidth,height=images[0].naturalHeight
    if(!width||!height||images.some(image=>image.naturalWidth!==width||image.naturalHeight!==height))throw new Error('Source frames have inconsistent dimensions')
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{alpha:false})
    canvas.width=width;canvas.height=height
    const preferred=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))
    if(!preferred)throw new Error('This Chromium instance cannot encode WebM')
    // A zero-rate stream with explicit requestFrame calls is deterministic in
    // Chromium headless; captureStream(fps) can otherwise drop the canvas
    // updates and leave a header-only WebM.
    const stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],chunks=[]
    const recorder=new MediaRecorder(stream,{mimeType:preferred,videoBitsPerSecond:4_500_000})
    const complete=new Promise((resolve,reject)=>{recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};recorder.onerror=()=>reject(recorder.error||new Error('MediaRecorder failed'));recorder.onstop=resolve})
    recorder.start()
    await delay(75)
    for(const image of images){
      context.drawImage(image,0,0,width,height)
      track.requestFrame?.()
      await delay(1000/fps)
    }
    await delay(1000/fps)
    recorder.stop()
    await complete
    stream.getTracks().forEach(item=>item.stop())
    const blob=new Blob(chunks,{type:preferred})
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})
    return {base64,mimeType:preferred,width,height,durationSeconds:images.length/fps}
  },{frames,fps})
}

await Promise.all([mkdir(resolve(publicRoot,'videos'),{recursive:true}),mkdir(resolve(publicRoot,'posters'),{recursive:true}),mkdir(reviewRoot,{recursive:true})])
const browser=await chromium.launch({headless:true})
const page=await browser.newPage()
const produced={}
try{
  for(const [avatar,asset] of Object.entries(avatars)){
    // File URLs taint a canvas in Chromium and create a header-only recording.
    // Embedded source-frame data keeps the rendering local and produces a
    // playable WebM without ever exposing source frames through a server.
    const frames=await Promise.all(Array.from({length:frameCount},(_,index)=>dataUrl(resolve(sourceRoot,asset.source,'source-frames','side',`frame-${String(index).padStart(3,'0')}.png`))))
    const encoded=await renderVideo(page,frames)
    const videoPath=resolve(publicRoot,asset.video),posterPath=resolve(publicRoot,asset.poster)
    await writeFile(videoPath,Buffer.from(encoded.base64,'base64'))
    await copyFile(resolve(sourceRoot,asset.source,'control-frames','standing-side.png'),posterPath)
    await copyFile(videoPath,resolve(reviewRoot,`squat-${avatar}.webm`))
    produced[avatar]={
      label:asset.label,video:`/media/exercises/${asset.video}`,poster:`/media/exercises/${asset.poster}`,
      reviewVideo:`squat-${avatar}.webm`,
      mimeType:encoded.mimeType,width:encoded.width,height:encoded.height,frameCount,durationSeconds:Number(encoded.durationSeconds.toFixed(6)),
      videoSha256:await digest(videoPath),posterSha256:await digest(posterPath),videoBytes:(await readFile(videoPath)).byteLength
    }
  }
}finally{await browser.close()}

await writeFile(resolve(reviewRoot,'video-release-manifest.json'),JSON.stringify({
  purpose:'Video-only candidate for user and specialist review. It contains rendered frames, not raw Mixamo GLB, FBX, skeletons or animation tracks.',
  source:'artifacts/squat-technique-review/<avatar>/source-frames/side/frame-000.png..frame-071.png',
  clip:'Original embedded Mixamo squat clip rendered earlier for local review; no retargeting or animation edit during video generation.',
  fps,avatars:produced
},null,2)+'\n')
console.log(JSON.stringify({releaseVideoCandidates:produced},null,2))
