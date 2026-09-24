import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { TechniqueVideoAsset } from '../exercise3d'

export default function TechniqueVideoViewer({asset,reducedMotion=false}:{asset:TechniqueVideoAsset;reducedMotion?:boolean}){
  const video=useRef<HTMLVideoElement>(null)
  const [playing,setPlaying]=useState(!reducedMotion)
  const [speed,setSpeed]=useState(.5)
  const [failed,setFailed]=useState(false)

  useEffect(()=>{
    const element=video.current
    setFailed(false)
    setSpeed(.5)
    setPlaying(!reducedMotion)
    if(element){element.currentTime=0;element.playbackRate=.5}
  },[asset.videoUrl,reducedMotion])

  useEffect(()=>{
    const element=video.current
    if(!element)return
    element.playbackRate=speed
    if(reducedMotion||!playing){element.pause();return}
    void element.play().catch(()=>setPlaying(false))
  },[playing,reducedMotion,speed])

  const reset=()=>{
    const element=video.current
    if(!element)return
    element.currentTime=0
    if(!reducedMotion){setPlaying(true);void element.play().catch(()=>setPlaying(false))}
  }

  if(reducedMotion)return <div className="exercise-video-static"><img src={asset.posterUrl} alt=""/><p>Анимация отключена в настройках уменьшения движения.</p></div>
  if(failed)return <div className="exercise-video-static"><img src={asset.posterUrl} alt=""/><p>Видео техники временно недоступно. Ориентируйся на ключевые моменты упражнения.</p></div>
  return <section className="exercise-video-viewer" aria-label={`Видео техники: ${asset.label}`}>
    <video ref={video} muted loop playsInline preload="metadata" poster={asset.posterUrl} onError={()=>setFailed(true)}>
      <source src={asset.videoUrl} type="video/webm"/>
    </video>
    <div className="exercise-video-controls">
      <button className="icon-button" type="button" aria-label={playing?'Пауза видео':'Запустить видео'} onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button>
      <button className="icon-button" type="button" aria-label="Вернуть начало видео" onClick={reset}><RotateCcw size={14}/></button>
      <div role="group" aria-label="Скорость видео"><button type="button" className={speed===.5?'is-active':''} aria-pressed={speed===.5} onClick={()=>setSpeed(.5)}>0.5×</button><button type="button" className={speed===1?'is-active':''} aria-pressed={speed===1} onClick={()=>setSpeed(1)}>1×</button></div>
    </div>
  </section>
}
