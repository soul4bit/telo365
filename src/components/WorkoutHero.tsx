import { useEffect, useRef, useState, type SyntheticEvent } from 'react'

type VideoId='primary'|'buffer'

const staticMediaQuery='(max-width:640px), (prefers-reduced-motion: reduce)'
const isStaticMode=()=>typeof window!=='undefined'&&window.matchMedia(staticMediaQuery).matches

/**
 * Decorative training hero. The second instance is deliberately mounted only
 * after the primary clip has started, so it can crossfade the loop without
 * making the first page render download two videos at once.
 */
export default function WorkoutHero({hasActiveWorkout=false}:{hasActiveWorkout?:boolean}){
  const root=useRef<HTMLElement>(null)
  const primary=useRef<HTMLVideoElement>(null)
  const buffer=useRef<HTMLVideoElement>(null)
  const crossfadeTimer=useRef<number|undefined>(undefined)
  const preloadTimer=useRef<number|undefined>(undefined)
  const switching=useRef(false)
  const [staticMode,setStaticMode]=useState(isStaticMode)
  const [inView,setInView]=useState(false)
  const [primaryReady,setPrimaryReady]=useState(false)
  const [bufferMounted,setBufferMounted]=useState(false)
  const [bufferReady,setBufferReady]=useState(false)
  const [active,setActive]=useState<VideoId>('primary')
  const [hasCrossfaded,setHasCrossfaded]=useState(false)

  useEffect(()=>{
    const query=window.matchMedia(staticMediaQuery)
    const update=()=>setStaticMode(query.matches)
    update()
    query.addEventListener('change',update)
    return()=>query.removeEventListener('change',update)
  },[])

  useEffect(()=>{
    if(staticMode)return
    const element=root.current
    if(!element)return
    if(!('IntersectionObserver' in window)){
      setInView(true)
      return
    }
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        setInView(true)
        observer.disconnect()
      }
    },{rootMargin:'240px 0px'})
    observer.observe(element)
    return()=>observer.disconnect()
  },[staticMode])

  useEffect(()=>()=>{
    if(crossfadeTimer.current!==undefined)window.clearTimeout(crossfadeTimer.current)
    if(preloadTimer.current!==undefined)window.clearTimeout(preloadTimer.current)
    primary.current?.pause()
    buffer.current?.pause()
  },[])

  useEffect(()=>{
    if(!staticMode)return
    primary.current?.pause()
    buffer.current?.pause()
  },[staticMode])

  const videoFor=(id:VideoId)=>id==='primary'?primary.current:buffer.current
  const other=(id:VideoId):VideoId=>id==='primary'?'buffer':'primary'

  const crossfadeTo=(next:VideoId)=>{
    if(switching.current||staticMode)return
    const current=videoFor(active)
    const target=videoFor(next)
    if(!current||!target||(next==='buffer'&&!bufferReady))return
    switching.current=true
    target.currentTime=0
    target.play().then(()=>{
      setActive(next)
      setHasCrossfaded(true)
      crossfadeTimer.current=window.setTimeout(()=>{
        current.pause()
        switching.current=false
      },950)
    }).catch(()=>{switching.current=false})
  }

  const watchLoop=(id:VideoId,event:SyntheticEvent<HTMLVideoElement>)=>{
    if(id!==active||switching.current)return
    const video=event.currentTarget
    if(Number.isFinite(video.duration)&&video.duration>0&&video.currentTime>=Math.max(0,video.duration-1))crossfadeTo(other(id))
  }

  const startPrimary=(video:HTMLVideoElement)=>{
    video.play().then(()=>{
      setPrimaryReady(true)
      if(preloadTimer.current===undefined)preloadTimer.current=window.setTimeout(()=>setBufferMounted(true),1200)
    }).catch(()=>{})
  }

  return <section ref={root} className="workout-hero" aria-labelledby="workout-hero-title">
    {inView&&!staticMode&&<div className={`workout-hero-media${hasCrossfaded?' is-crossfading':''}`} aria-hidden="true">
      <video ref={primary} className={`workout-hero-video${primaryReady?' is-ready':''}${active==='primary'?' is-active':''}`} autoPlay muted loop playsInline preload="metadata" poster="/images/workout.jpg" tabIndex={-1} onCanPlay={event=>startPrimary(event.currentTarget)} onTimeUpdate={event=>watchLoop('primary',event)} onError={event=>{event.currentTarget.style.display='none'}}>
        <source src="/media/workout-hero.mp4" type="video/mp4" />
      </video>
      {bufferMounted&&<video ref={buffer} className={`workout-hero-video${bufferReady?' is-ready':''}${active==='buffer'?' is-active':''}`} muted loop playsInline preload="metadata" poster="/images/workout.jpg" tabIndex={-1} onCanPlay={event=>setBufferReady(true)} onTimeUpdate={event=>watchLoop('buffer',event)} onError={event=>{event.currentTarget.style.display='none';setBufferReady(false)}}>
        <source src="/media/workout-hero.mp4" type="video/mp4" />
      </video>}
    </div>}
    <div className="workout-hero-content">
      <span className="eyebrow">ТРЕНИРОВКИ · ТВОЙ РИТМ</span>
      <h2 id="workout-hero-title">Двигайся в своём ритме</h2>
      <p>Персональный план с учётом твоего уровня, времени и возможностей.</p>
      <a className="primary-button workout-hero-cta" href="#today-workout" aria-label={hasActiveWorkout?'Продолжить активную тренировку':'Начать тренировку на сегодня'}>{hasActiveWorkout?'Продолжить тренировку':'Начать тренировку'} <span aria-hidden="true">→</span></a>
    </div>
  </section>
}
