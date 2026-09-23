import { useEffect, useRef, useState } from 'react'

type VideoId='primary'|'walk'
const staticMediaQuery='(max-width:640px), (prefers-reduced-motion:reduce)'
const isStaticMode=()=>typeof window!=='undefined'&&window.matchMedia(staticMediaQuery).matches

export default function HeroVideoBackground(){
  const [staticMode,setStaticMode]=useState(isStaticMode)
  const [primaryReady,setPrimaryReady]=useState(false)
  const [walkMounted,setWalkMounted]=useState(false)
  const [walkReady,setWalkReady]=useState(false)
  const [active,setActive]=useState<VideoId>('primary')
  const [hasSwitched,setHasSwitched]=useState(false)
  const primary=useRef<HTMLVideoElement>(null)
  const walk=useRef<HTMLVideoElement>(null)
  const started=useRef(false)
  const preloadTimer=useRef<number|undefined>(undefined)

  useEffect(()=>{
    const query=window.matchMedia(staticMediaQuery)
    const update=()=>setStaticMode(query.matches)
    update()
    query.addEventListener('change',update)
    return()=>query.removeEventListener('change',update)
  },[])

  useEffect(()=>()=>{if(preloadTimer.current!==undefined)window.clearTimeout(preloadTimer.current)},[])
  useEffect(()=>{
    if(!staticMode)return
    started.current=false
    primary.current?.pause()
    walk.current?.pause()
  },[staticMode])

  const restart=(video:HTMLVideoElement|null)=>{
    if(!video)return
    video.currentTime=0
    video.play().catch(()=>{})
  }
  const changeTo=(next:VideoId)=>{
    const current=active==='primary'?primary.current:walk.current
    const target=next==='primary'?primary.current:walk.current
    if(!target||target.readyState<2){restart(current);return}
    target.currentTime=0
    target.play().then(()=>{setHasSwitched(true);setActive(next)}).catch(()=>restart(current))
  }
  const startPrimary=(video:HTMLVideoElement)=>{
    if(started.current)return
    started.current=true
    video.play().then(()=>{
      setPrimaryReady(true)
      preloadTimer.current=window.setTimeout(()=>setWalkMounted(true),1200)
    }).catch(()=>{started.current=false})
  }

  if(staticMode)return null
  return <div className={`workspace-hero-media${hasSwitched?' is-crossfading':''}`} aria-hidden="true">
    <video ref={primary} className={`workspace-hero-video workspace-hero-video--primary${primaryReady?' is-ready':''}${active==='primary'?' is-active':''}`} autoPlay muted playsInline preload="metadata" poster="/images/hero.png" tabIndex={-1} onCanPlay={event=>startPrimary(event.currentTarget)} onEnded={()=>changeTo('walk')} onError={event=>{event.currentTarget.style.display='none'}}>
      <source src="/video/hero-telo365.web.mp4" type="video/mp4" />
    </video>
    {walkMounted&&<video ref={walk} className={`workspace-hero-video workspace-hero-video--walk${walkReady?' is-ready':''}${active==='walk'?' is-active':''}`} muted playsInline preload="auto" poster="/images/hero.png" tabIndex={-1} onCanPlay={()=>setWalkReady(true)} onEnded={()=>changeTo('primary')} onError={()=>{setWalkReady(false);setWalkMounted(false)}}>
      <source src="/video/hero-telo365-walk.web.mp4" type="video/mp4" />
    </video>}
  </div>
}
