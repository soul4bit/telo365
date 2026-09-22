import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowRight, Heart, Activity, Utensils, Check, Sprout, Eye, EyeOff } from 'lucide-react'
import { api } from './api'
import { Logo } from './components/ui'
import Dashboard from './components/Dashboard'
import Onboarding from './Onboarding'
import EmailPage from './components/Email'
import Auth from './Auth'
import Marketing, { LegalPage } from './components/Marketing'
import './workspace.css'
import './auth.css'
const Demo=lazy(()=>import('./Demo'))
export default function App(){
  const path=window.location.pathname
  if(['/forgot','/email/verify','/email/reset'].includes(path))return <EmailPage/>
  if(path==='/demo')return <Suspense fallback={<p className="loading-page">Открываем демо…</p>}><div className="demo-back"><a href="/">← О сервисе</a><a href="/register">Создать свой кабинет →</a></div><Demo/></Suspense>
  if(path==='/app')return <Dashboard/>
  if(path==='/onboarding')return <Onboarding/>
  if(['/login','/register','/recover'].includes(path))return <Auth mode={path.slice(1)}/>
  if(path==='/privacy')return <LegalPage page="privacy"/>
  if(path==='/terms')return <LegalPage page="terms"/>
  if(path==='/about')return <LegalPage page="about"/>
  if(path==='/contacts')return <LegalPage page="contacts"/>
  return <Marketing/>
}
function Landing(){
  const [intro,setIntro]=useState('Питание, движение и привычки в твоём ритме.')
  useEffect(()=>{api<{intro:string}>('/api/public').then(r=>setIntro(r.intro)).catch(()=>{})},[])
  return <div className="landing"><header className="landing-nav"><a href="/"><Logo/></a><nav><a href="/demo">Посмотреть демо</a><a className="soft-button" href="/login">Войти</a></nav></header><section className="landing-hero"><span className="eyebrow">ТВОЙ ЛИЧНЫЙ РИТМ · TELO365</span><h1>Твоё тело.<br/>Каждый день.</h1><p>{intro}</p><div className="landing-actions"><a className="primary-button" href="/register">Начать с себя <ArrowRight size={18}/></a><a href="/demo">Заглянуть в кабинет →</a></div><span className="landing-note">Маленькие шаги. Настоящий прогресс.</span></section><section className="landing-features">{[[Heart,'Замечай свой прогресс','Вес, цели и привычки — с историей по дням.'],[Utensils,'Собери свой рацион','Продукты, рецепты, порции и список покупок.'],[Activity,'Двигайся в своём ритме','Планируй занятия и сохраняй подходы и повторения.']].map(([Icon,title,text])=>{const I=Icon as typeof Heart;return <article key={title as string}><span className="round-icon green"><I/></span><h2>{title as string}</h2><p>{text as string}</p></article>})}</section><section className="landing-bottom"><Sprout size={36}/><div><h2>Начни с одного хорошего дня</h2><p>Твои записи будут доступны на телефоне и компьютере.</p></div><a className="primary-button" href="/register">Создать аккаунт <ArrowRight size={17}/></a></section><footer className="landing-footer"><span>© {new Date().getFullYear()} TELO365 · Ранняя версия</span><a href="/privacy">О данных и доступе</a></footer></div>
}
