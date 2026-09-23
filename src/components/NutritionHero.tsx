import { useEffect, useRef, useState } from 'react'

const staticMediaQuery='(max-width:640px), (prefers-reduced-motion:reduce)'
const isStaticMode=()=>typeof window!=='undefined'&&window.matchMedia(staticMediaQuery).matches

export default function NutritionHero(){
  const [staticMode,setStaticMode]=useState(isStaticMode)
  const [ready,setReady]=useState(false)
  const started=useRef(false)

  useEffect(()=>{
    const query=window.matchMedia(staticMediaQuery)
    const update=()=>setStaticMode(query.matches)
    update()
    query.addEventListener('change',update)
    return()=>query.removeEventListener('change',update)
  },[])

  const start=(video:HTMLVideoElement)=>{
    if(started.current)return
    started.current=true
    video.play().then(()=>setReady(true)).catch(()=>{started.current=false})
  }

  return <section className="nutrition-hero" aria-labelledby="nutrition-hero-title">
    {!staticMode&&<div className="nutrition-hero-media" aria-hidden="true">
      <video className={`nutrition-hero-video${ready?' is-ready':''}`} autoPlay muted loop playsInline preload="metadata" poster="/media/nutrition-hero-poster.webp" tabIndex={-1} onCanPlay={event=>start(event.currentTarget)} onError={event=>{event.currentTarget.style.display='none'}}>
        <source src="/media/nutrition-hero.mp4" type="video/mp4" />
      </video>
    </div>}
    <div className="nutrition-hero-content">
      <span className="eyebrow">ПИТАНИЕ · ТВОЙ РИТМ</span>
      <h2 id="nutrition-hero-title">Питание без сложностей</h2>
      <p>Рацион под твой ритм, бюджет и привычные продукты.</p>
      <a className="primary-button nutrition-hero-cta" href="#nutrition-today" aria-label="Открыть план питания на сегодня">План на сегодня <span aria-hidden="true">→</span></a>
    </div>
  </section>
}
