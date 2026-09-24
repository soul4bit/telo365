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
  male:{label:'Мужчина',source:'male'},
  female:{label:'Женщина',source:'female'}
}
const angles=[
  {id:'front',source:'front',label:'Спереди'},
  {id:'side',source:'side',label:'Сбоку'},
  {id:'back',source:'back',label:'Сзади'},
  {id:'threeQuarter',source:'three-quarter',label:'3/4'}
]

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
    const avatarResult={label:asset.label,defaultAngle:'threeQuarter',angles:{}}
    for(const angle of angles){
      // File URLs taint a canvas in Chromium and create a header-only recording.
      // Embedded review frames keep rendering local and publish only final video.
      const frames=await Promise.all(Array.from({length:frameCount},(_,index)=>dataUrl(resolve(sourceRoot,asset.source,'source-frames',angle.source,`frame-${String(index).padStart(3,'0')}.png`))))
      const encoded=await renderVideo(page,frames)
      const basename=`squat-${avatar}-${angle.source}`
      const videoPath=resolve(publicRoot,'videos',`${basename}.webm`),posterPath=resolve(publicRoot,'posters',`${basename}.png`)
      await writeFile(videoPath,Buffer.from(encoded.base64,'base64'))
      await copyFile(resolve(sourceRoot,asset.source,'source-frames',angle.source,'frame-000.png'),posterPath)
      await copyFile(videoPath,resolve(reviewRoot,`${basename}.webm`))
      avatarResult.angles[angle.id]={
        label:angle.label,video:`/media/exercises/videos/${basename}.webm`,poster:`/media/exercises/posters/${basename}.png`,reviewVideo:`${basename}.webm`,
        mimeType:encoded.mimeType,width:encoded.width,height:encoded.height,frameCount,durationSeconds:Number(encoded.durationSeconds.toFixed(6)),
        videoSha256:await digest(videoPath),posterSha256:await digest(posterPath),videoBytes:(await readFile(videoPath)).byteLength
      }
    }
    produced[avatar]=avatarResult
  }
}finally{await browser.close()}

await writeFile(resolve(reviewRoot,'video-release-manifest.json'),JSON.stringify({
  purpose:'Video-only candidate for user and specialist review. It contains rendered frames with a locally built stylized gym scene, not raw Mixamo GLB, FBX, skeletons or animation tracks.',
  source:'artifacts/squat-technique-review/<avatar>/source-frames/<view>/frame-000.png..frame-071.png',
  clip:'Original embedded Mixamo squat clip rendered earlier for local review; no retargeting or animation edit during video generation.',
  fps,avatars:produced
},null,2)+'\n')
console.log(JSON.stringify({releaseVideoCandidates:produced},null,2))
