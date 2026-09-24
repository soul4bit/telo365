import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { TechniqueVideoAngle, TechniqueVideoAsset } from '../exercise3d'

export default function TechniqueVideoViewer({asset,reducedMotion=false}:{asset:TechniqueVideoAsset;reducedMotion?:boolean}){
  const video=useRef<HTMLVideoElement>(null)
  const [playing,setPlaying]=useState(!reducedMotion)
  const [speed,setSpeed]=useState(.5)
  const [failed,setFailed]=useState(false)
  const [angle,setAngle]=useState<TechniqueVideoAngle>(asset.defaultAngle)
  const selected=asset.angles[angle]

  useEffect(()=>{
    const element=video.current
    setFailed(false)
    setSpeed(.5)
    setPlaying(!reducedMotion)
    if(element){element.currentTime=0;element.playbackRate=.5}
  },[reducedMotion,selected.videoUrl])

  useEffect(()=>setAngle(asset.defaultAngle),[asset.defaultAngle])

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

  if(reducedMotion)return <div className="exercise-video-static"><div className="exercise-video-stage"><img src={selected.posterUrl} alt=""/><span className="exercise-video-watermark" aria-hidden="true">TELO365.RU</span></div><p>Анимация отключена в настройках уменьшения движения.</p></div>
  if(failed)return <div className="exercise-video-static"><div className="exercise-video-stage"><img src={selected.posterUrl} alt=""/><span className="exercise-video-watermark" aria-hidden="true">TELO365.RU</span></div><p>Видео техники временно недоступно. Ориентируйся на ключевые моменты упражнения.</p></div>
  return <section className="exercise-video-viewer" aria-label={`Видео техники: ${asset.label}`}>
    <div className="exercise-video-stage">
      <video key={selected.videoUrl} ref={video} muted loop playsInline preload="metadata" poster={selected.posterUrl} onError={()=>setFailed(true)}>
        <source src={selected.videoUrl} type="video/webm"/>
      </video>
      <span className="exercise-video-watermark" aria-hidden="true">TELO365.RU</span>
    </div>
    <div className="exercise-video-controls">
      <button className="icon-button" type="button" aria-label={playing?'Пауза видео':'Запустить видео'} onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button>
      <button className="icon-button" type="button" aria-label="Вернуть начало видео" onClick={reset}><RotateCcw size={14}/></button>
      <div role="group" aria-label="Скорость видео"><button type="button" className={speed===.5?'is-active':''} aria-pressed={speed===.5} onClick={()=>setSpeed(.5)}>0.5×</button><button type="button" className={speed===1?'is-active':''} aria-pressed={speed===1} onClick={()=>setSpeed(1)}>1×</button></div>
      <div className="exercise-video-angle-switch" role="group" aria-label="Ракурс демонстрации"><span>Ракурс</span>{(Object.keys(asset.angles) as TechniqueVideoAngle[]).map(next=><button key={next} type="button" className={angle===next?'is-active':''} aria-pressed={angle===next} onClick={()=>setAngle(next)}>{asset.angles[next].label}</button>)}</div>
    </div>
  </section>
}
