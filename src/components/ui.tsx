import { useEffect, useRef, type ReactNode } from 'react'
import { Sprout, X, ArrowRight } from 'lucide-react'
export function Logo(){return <div className="logo"><Sprout/><span>TELO<b>365</b></span></div>}
export function Dialog({title,children,close}:{title:string;children:ReactNode;close:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.showModal();return()=>previous?.focus()},[])
  return <dialog ref={ref} aria-label={title} onCancel={close} onClick={e=>{if(e.target===ref.current)close()}}><div className="dialog-head"><h2>{title}</h2><button className="icon-button" aria-label="Закрыть" onClick={close}><X/></button></div>{children}</dialog>
}
export function Empty({children,action,label}:{children:ReactNode;action?:()=>void;label?:string}) {return <div className="journal-empty"><Sprout size={28}/><p>{children}</p>{action&&<button className="soft-button" onClick={action}>{label||'Добавить'}<ArrowRight size={15}/></button>}</div>}
export function Title({children,action,label='Добавить'}:{children:ReactNode;action?:()=>void;label?:string}) {return <div className="section-title"><h2>{children}</h2>{action&&<button className="text-button" onClick={action}>{label}<ArrowRight size={15}/></button>}</div>}
export function ErrorMessage({error}:{error:string}){return error?<p className="form-error" role="alert">{error}</p>:null}
export const errorText=(error:unknown)=>error instanceof Error?error.message:'Не удалось сохранить изменения'
