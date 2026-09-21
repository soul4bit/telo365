import { useState } from 'react'
import { Camera, Check, LoaderCircle, ScanLine, Upload } from 'lucide-react'
import { api, fmt, type Macros, type Mutate } from '../api'
import { ErrorMessage, errorText } from './ui'
import '../photo-meal.css'

type Estimate=Macros&{name:string;confidence:'low'|'medium'|'high';components:{name:string;grams:number}[]}
const confidence={low:'Низкая уверенность',medium:'Средняя уверенность',high:'Высокая уверенность'} as const

async function resize(file:File) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Подойдут фотографии JPG, PNG или WebP')
  if(file.size>12*1024*1024) throw new Error('Выберите файл до 12 МБ')
  const source=URL.createObjectURL(file)
  try {
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=()=>reject(new Error('Не удалось прочитать фотографию'));element.src=source})
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
    canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height)
    let quality=.84;let blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality))
    if(blob&&blob.size>2300000) {quality=.68;blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality))}
    if(!blob||blob.size>2500000) throw new Error('Не удалось уменьшить фото. Сделайте снимок ближе или выберите другой')
    return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать фотографию'));reader.readAsDataURL(blob)})
  } finally {URL.revokeObjectURL(source)}
}

export default function PhotoMeal({mutate,busy}:{mutate:Mutate;busy:boolean}) {
  const [image,setImage]=useState(''),[estimate,setEstimate]=useState<Estimate|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[saved,setSaved]=useState(false)
  async function choose(file?:File) {if(!file)return;setLoading(true);setError('');setEstimate(null);setSaved(false);try{setImage(await resize(file))}catch(reason){setImage('');setError(errorText(reason))}finally{setLoading(false)}}
  async function analyze(){if(!image)return;setLoading(true);setError('');setSaved(false);try{setEstimate(await api<Estimate>('/api/nutrition/analyze-photo','POST',{image}))}catch(reason){setError(errorText(reason))}finally{setLoading(false)}}
  async function save(){if(!estimate)return;const grams=estimate.components.reduce((sum,item)=>sum+item.grams,0);const portion=Math.max(grams/100,1);setLoading(true);setError('');try{await mutate('/api/catalog','POST',{kind:'food',name:`${estimate.name} — по фото`,kcal:Math.round(estimate.kcal/portion),p:Math.round(estimate.p/portion*10)/10,f:Math.round(estimate.f/portion*10)/10,c:Math.round(estimate.c/portion*10)/10,source:'Оценка по фото — проверьте состав и порцию'});setSaved(true)}catch(reason){setError(errorText(reason))}finally{setLoading(false)}}
  return <section className="card photo-meal"><div className="photo-meal-heading"><span className="round-icon green"><ScanLine/></span><div><h2>Добавить еду по фото</h2><p>Сфотографируй блюдо — попробуем определить продукты и примерные КБЖУ.</p></div></div><label className="photo-picker"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event=>choose(event.currentTarget.files?.[0])}/><Upload size={17}/><span>{image?'Выбрать другое фото':'Выбрать фото'}</span></label>{image&&<div className="photo-preview"><img src={image} alt="Выбранное блюдо"/><button className="primary-button" disabled={loading||busy} onClick={analyze}>{loading?<LoaderCircle className="spin" size={17}/>:<Camera size={17}/>}Распознать блюдо</button></div>}<details className="photo-privacy"><summary>Подробнее о приватности</summary><p>Фото передаётся OpenAI только для этого запроса и не сохраняется в TELO365. Оценка может ошибаться — сверяйте порцию и данные с упаковки.</p></details><ErrorMessage error={error}/>{estimate&&<div className="photo-result"><div className="photo-result-title"><div><small>{confidence[estimate.confidence]}</small><h3>{estimate.name}</h3></div><strong>{fmt(estimate.kcal)} <small>ккал</small></strong></div><div className="photo-macros"><span>Б <b>{fmt(estimate.p)} г</b></span><span>Ж <b>{fmt(estimate.f)} г</b></span><span>У <b>{fmt(estimate.c)} г</b></span></div><p>{estimate.components.map(item=>`${item.name} · ${fmt(item.grams)} г`).join(', ')}</p>{saved?<p className="photo-saved"><Check size={15}/>Добавлено в личный каталог. Найдите блюдо во вкладке «Продукты», чтобы внести его в дневник.</p>:<button className="soft-button" disabled={loading||busy} onClick={save}><Check size={15}/>Сохранить как свой продукт</button>}</div>}</section>
}
