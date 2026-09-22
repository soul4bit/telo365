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
function Privacy(){return <div className="legal-page"><a href="/"><Logo/></a><h1>О данных и доступе</h1><p>TELO365 — ранняя версия личного дневника. В аккаунте хранятся email для входа, имя, выбранная цель, часовой пояс, необязательные настройки ориентира по жидкости и записи, которые вы добавляете: вес, привычки, питание, тренировки и покупки.</p><h2>Где хранятся записи</h2><p>Данные сохраняются на сервере TELO365 и доступны после входа с ваших устройств. Сервер использует cookie для поддержания входа. В публичном демо отметки хранятся отдельно в браузере и не переносятся в аккаунт автоматически. Сторонняя аналитика и рекламные трекеры не подключены.</p><h2>Управление данными</h2><p>В профиле можно скачать свои записи и удалить аккаунт. После удаления активные данные и сеансы удаляются. Резервные копии на сервере хранятся до 14 дней; при восстановлении оператор должен повторно применить удаления, сделанные после даты копии.</p><h2>Восстановление доступа</h2><p>При регистрации выдаётся резервный код. Почту для восстановления можно подтвердить в профиле. В тестовом режиме письма хранятся в закрытом тестовом ящике администратора и не доставляются во внешнюю почту. Сохраните код: без него самостоятельное восстановление невозможно. В профиле можно заменить пароль и выпустить новый код.</p><h2>Распознавание еды по фото</h2><p>Если вы сами отправляете фото блюда на распознавание, снимок передаётся OpenAI для подготовки ориентировочной оценки состава и КБЖУ. TELO365 не сохраняет такие фотографии. Полученную оценку нужно проверить перед добавлением в дневник.</p><h2>Контент</h2><p>Сервис помогает вести записи, но не назначает рацион и нагрузки. Начальные продукты и программы помечены как примеры. Для своего дневника добавляйте значения с упаковки продуктов и подходящие вам упражнения.</p><a className="soft-button" href="/">Вернуться на главную</a></div>}
