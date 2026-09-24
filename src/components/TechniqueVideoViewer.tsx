import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Video } from 'lucide-react'
import { getTechniqueVideoAngle, getTechniqueVideoAngles, type TechniqueVideoAngle, type TechniqueVideoAngleAsset, type TechniqueVideoAsset } from '../exercise3d'

const copy={
  start:'\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u044e',
  motionReduced:'\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u0432\u043e\u0441\u043f\u0440\u043e\u0438\u0437\u0432\u0435\u0434\u0435\u043d\u0438\u0435 \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u043e \u0432 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445 \u0443\u043c\u0435\u043d\u044c\u0448\u0435\u043d\u0438\u044f \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u044f.',
  unavailable:'\u0412\u0438\u0434\u0435\u043e \u0442\u0435\u0445\u043d\u0438\u043a\u0438 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u041e\u0440\u0438\u0435\u043d\u0442\u0438\u0440\u0443\u0439\u0441\u044f \u043d\u0430 \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u043c\u043e\u043c\u0435\u043d\u0442\u044b \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u044f.',
  noAngle:'\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u044f \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0439 \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u0438.',
  pause:'\u041f\u0430\u0443\u0437\u0430 \u0432\u0438\u0434\u0435\u043e',
  play:'\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0432\u0438\u0434\u0435\u043e',
  reset:'\u0412\u0435\u0440\u043d\u0443\u0442\u044c \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e \u0432\u0438\u0434\u0435\u043e',
  speed:'\u0421\u043a\u043e\u0440\u043e\u0441\u0442\u044c \u0432\u0438\u0434\u0435\u043e',
  angle:'\u0420\u0430\u043a\u0443\u0440\u0441 \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u0438',
  angleLabel:'\u0420\u0430\u043a\u0443\u0440\u0441'
}

function PosterStage({media}:{media:TechniqueVideoAngleAsset}){
  const [failedPoster,setFailedPoster]=useState<string|null>(null)
  return <div className="exercise-video-stage">
    {media.posterUrl&&failedPoster!==media.posterUrl?<img src={media.posterUrl} alt="" onError={()=>setFailedPoster(media.posterUrl)}/>:<div className="exercise-video-poster-placeholder"><Video size={30} aria-hidden="true"/><p>{copy.noAngle}</p></div>}
  </div>
}

export default function TechniqueVideoViewer({asset,reducedMotion=false}:{asset:TechniqueVideoAsset;reducedMotion?:boolean}){
  const video=useRef<HTMLVideoElement>(null)
  const availableAngles=useMemo(()=>getTechniqueVideoAngles(asset),[asset])
  const [playing,setPlaying]=useState(!reducedMotion)
  const [speed,setSpeed]=useState(1)
  const [failedUrl,setFailedUrl]=useState<string|null>(null)
  const [angle,setAngle]=useState<TechniqueVideoAngle>(asset.defaultAngle)
  const [manualMotion,setManualMotion]=useState(false)
  const selected=getTechniqueVideoAngle(asset,angle)
  const source=selected?.videoUrl
  const failed=!!source&&failedUrl===source
  const showStatic=reducedMotion&&!manualMotion

  useEffect(()=>{
    setManualMotion(false)
    setPlaying(!reducedMotion)
  },[reducedMotion])

  useEffect(()=>{
    const element=video.current
    if(!element||showStatic||failed)return
    let active=true
    element.playbackRate=speed
    if(!playing)element.pause()
    else void element.play().catch(()=>{if(active)setPlaying(false)})
    // Changing source unmounts the old video. Cancel its late play rejection
    // and pause it so it cannot override the newly selected trainer's state.
    return()=>{active=false;element.pause()}
  },[source,playing,showStatic,speed,failed])

  const reset=()=>{
    const element=video.current
    if(!element)return
    element.currentTime=0
    setPlaying(true)
    void element.play().catch(()=>{if(video.current===element)setPlaying(false)})
  }

  if(!selected)return <div className="exercise-video-static"><p>{copy.noAngle}</p></div>

  return <section className="exercise-video-viewer" aria-label={`\u0412\u0438\u0434\u0435\u043e \u0442\u0435\u0445\u043d\u0438\u043a\u0438: ${asset.label}`} data-studio-id={asset.studio.id} data-branding={asset.studio.branding}>
    {showStatic||failed?<div className="exercise-video-static">
      <PosterStage media={selected}/>
      <p role="status">{failed?copy.unavailable:copy.motionReduced}</p>
      {showStatic&&!failed?<button className="exercise-video-motion-start" type="button" onClick={()=>{setManualMotion(true);setPlaying(true)}}>{copy.start}</button>:null}
    </div>:<div className="exercise-video-stage">
      <video key={selected.videoUrl} ref={video} muted loop playsInline preload="metadata" poster={selected.posterUrl} onError={()=>setFailedUrl(selected.videoUrl)}>
        <source src={selected.videoUrl} type="video/webm" onError={()=>setFailedUrl(selected.videoUrl)}/>
      </video>
    </div>}
    <div className="exercise-video-controls">
      <button className="icon-button" type="button" disabled={failed} aria-label={!showStatic&&playing?copy.pause:copy.play} onClick={()=>{if(showStatic){setManualMotion(true);setPlaying(true)}else setPlaying(value=>!value)}}>{!showStatic&&playing?<Pause size={15}/>:<Play size={15}/>}</button>
      <button className="icon-button" type="button" disabled={failed||showStatic} aria-label={copy.reset} onClick={reset}><RotateCcw size={14}/></button>
      <div role="group" aria-label={copy.speed}><button type="button" className={speed===.5?'is-active':''} aria-pressed={speed===.5} onClick={()=>setSpeed(.5)}>0.5{'\u00d7'}</button><button type="button" className={speed===1?'is-active':''} aria-pressed={speed===1} onClick={()=>setSpeed(1)}>1{'\u00d7'}</button></div>
      {availableAngles.length>1?<div className="exercise-video-angle-switch" role="group" aria-label={copy.angle}><span>{copy.angleLabel}</span>{availableAngles.map(next=><button key={next.angle} type="button" className={selected.angle===next.angle?'is-active':''} aria-pressed={selected.angle===next.angle} onClick={()=>setAngle(next.angle)}>{next.label}</button>)}</div>:null}
    </div>
  </section>
}
