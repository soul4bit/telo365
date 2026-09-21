import { useEffect, useState } from 'react'
import { api, download } from '../api'
import { Logo, ErrorMessage, errorText } from './ui'

export function MailNotice(){
  const [mode,setMode]=useState('off')
  useEffect(()=>{api<{mode:string}>('/api/auth/mail').then(r=>setMode(r.mode)).catch(()=>{})},[])
  return <p className="form-note">{mode==='capture'?'Почта в тестовом режиме: письма доступны в тестовом ящике администратора. Во внешнюю почту они не доставляются.':mode==='smtp'?'Письма отправляются на ваш адрес. Для восстановления сначала подтвердите почту в профиле.':'Отправка писем пока отключена. Для восстановления используйте резервный код.'}</p>
}
export function EmailProfile({email,verified}:{email:string;verified:boolean}){
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  return <section className="card"><h2>Почта для восстановления</h2><p className="form-note">{email} · {verified?'Подтверждена':'Не подтверждена'}</p><MailNotice/>{!verified&&<button className="soft-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api('/api/auth/email/request','POST',{});setMessage('Запрос принят. Откройте письмо и подтвердите адрес.')}catch(e){setError(errorText(e))}finally{setBusy(false)}}}>Подтвердить почту</button>}<p role="status" className="form-note">{message}</p><ErrorMessage error={error}/></section>
}
export default function EmailPage(){
  const path=location.pathname,verify=path==='/email/verify',reset=path==='/email/reset'
  const [token]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('token')||'')
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[code,setCode]=useState('')
  useEffect(()=>{if(location.hash)history.replaceState(null,'',location.pathname)},[])
  return <main className="auth-page"><a href="/" className="auth-brand"><Logo/></a><section className="auth-card"><h1>{verify?'Подтверждение почты':reset?'Новый пароль':'Восстановление по почте'}</h1><MailNotice/>{message?<><p role="status">{message}</p>{code&&<><p>Сохраните новый резервный код. Предыдущий больше не действует.</p><code className="recovery-code">{code}</code><button className="soft-button" onClick={()=>download('telo365-recovery.txt',code)}>Скачать код</button></>}<a className="primary-button" href={verify?'/app':'/login'}>{verify?'В кабинет':'Войти'}</a></>:<form className="workspace-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);try{const r=await api<{message?:string;recoveryCode?:string}>(`/api/auth/email/${verify?'verify':reset?'reset':'forgot'}`,'POST',{token,email:f.get('email'),password:f.get('password')});if(r.recoveryCode)setCode(r.recoveryCode);setMessage(verify?'Адрес подтверждён.':reset?'Пароль изменён. Войдите заново.':r.message||'Запрос принят.')}catch(e){setError(errorText(e))}finally{setBusy(false)}}}>{!verify&&!reset&&<label>Email<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>}{reset&&<label>Новый пароль<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>}{(verify||reset)&&!token&&<p>В ссылке нет кода. Откройте ссылку из письма ещё раз.</p>}<ErrorMessage error={error}/><button className="primary-button" disabled={busy||((verify||reset)&&!token)}>{verify?'Подтвердить адрес':reset?'Сохранить пароль':'Отправить ссылку'}</button></form>}<div className="auth-links"><a href="/login">Вернуться ко входу</a><a href="/recover">Использовать резервный код</a></div></section></main>
}
