import { useMemo, useState } from 'react'
import { Check, Flame, Pencil, Plus, Sparkles, Target, X } from 'lucide-react'
import { type Mutate, type State } from '../api'
import { Dialog, Empty, ErrorMessage, errorText } from './ui'
import '../habits.css'

type Habit=State['habits'][number]
const templates=[['💧','Вода','daily',7],['🌙','Сон до полуночи','daily',7],['🚶','Прогулка','daily',5],['🧘','10 минут для себя','daily',4],['🥗','Овощи в рационе','daily',5],['📵','Без телефона перед сном','weekdays',5]] as const
const scheduleLabels={daily:'Каждый день',weekdays:'По будням',weekends:'По выходным'} as const
const dayNames=['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const atNoon=(date:string)=>new Date(`${date}T12:00:00Z`)
const plusDays=(date:string,days:number)=>{const value=atNoon(date);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)}
const scheduled=(habit:Habit,date:string)=>{const day=atNoon(date).getUTCDay();return habit.schedule==='weekdays'?day>0&&day<6:habit.schedule==='weekends'?day===0||day===6:true}
const keyFor=(habit:Habit,date:string)=>`${habit.id}:${date}`

function streak(habit:Habit,done:Set<string>,end:string){let count=0,date=end;for(let n=0;n<366;n++,date=plusDays(date,-1)){if(!scheduled(habit,date))continue;if(!done.has(keyFor(habit,date)))break;count++}return count}
function weekDates(day:string){const date=atNoon(day),offset=(date.getUTCDay()+6)%7;return Array.from({length:7},(_,index)=>plusDays(day,-offset+index))}

export default function Habits({data,mutate,busy,full=false}:{data:State;mutate:Mutate;busy:boolean;full?:boolean}) {
  const [editor,setEditor]=useState<'new'|'edit'|null>(null),[current,setCurrent]=useState<Habit|null>(null),[error,setError]=useState('')
  const done=useMemo(()=>new Set(data.marks.filter(mark=>mark.done).map(mark=>`${mark.habit_id}:${mark.date}`)),[data.marks])
  const selected=data.date>data.today?data.today:data.date
  const week=weekDates(selected)
  const active=data.habits.filter(habit=>scheduled(habit,selected))
  const completed=active.filter(habit=>done.has(keyFor(habit,selected))).length
  const perform=async(path:string,method:string,body?:unknown)=>{setError('');try{await mutate(path,method,body)}catch(reason){setError(errorText(reason))}}
  const openNew=()=>{setCurrent(null);setEditor('new')}
  const openEdit=(habit:Habit)=>{setCurrent(habit);setEditor('edit')}
  const cards=full?data.habits: data.habits.slice(0,5)
  return <section className={`card habits-panel ${full?'habits-panel-full':''}`}><div className="habits-heading"><div><span className="eyebrow">ТВОЙ РИТМ</span><h2>{full?'Привычки':'Привычки за день'}</h2><p>{data.date>data.today?'Отметки станут доступны в этот день':active.length?`Сегодня ${completed} из ${active.length} запланировано`:'На сегодня нет запланированных привычек'}</p></div><button className="soft-button" onClick={openNew}><Plus size={16}/>Новая</button></div>{full&&<><div className="habit-hero-stats"><div><span className="round-icon green"><Flame size={19}/></span><strong>{data.habits.length?Math.max(...data.habits.map(habit=>streak(habit,done,selected))):0}</strong><small>лучшая серия сейчас</small></div><div><span className="round-icon yellow"><Target size={19}/></span><strong>{completed}/{active.length}</strong><small>сделано сегодня</small></div><div><span className="round-icon purple"><Sparkles size={19}/></span><strong>{data.habits.length}</strong><small>в твоём ритме</small></div></div><div className="habit-templates"><span>Быстро добавить:</span>{templates.filter(template=>!data.habits.some(habit=>habit.name===template[1])).slice(0,4).map(([icon,name,schedule,weeklyTarget])=><button key={name} disabled={busy} onClick={()=>perform('/api/habits','POST',{name,icon,schedule,weeklyTarget})}>{icon} {name}</button>)}</div></>}{!data.habits.length?<Empty action={openNew} label="Создать привычку">Начни с одного маленького действия. Его легко заметить, а потом повторить.</Empty>:<div className="habit-cards">{cards.map(habit=>{const isDone=done.has(keyFor(habit,data.date)),isScheduled=scheduled(habit,data.date),currentStreak=streak(habit,done,selected),weekDone=week.filter(date=>scheduled(habit,date)&&done.has(keyFor(habit,date))).length;return <article className={`habit-card ${isDone?'is-done':''}`} key={habit.id}><div className="habit-card-top"><button className="habit-toggle" aria-label={`${habit.name}: ${isDone?'выполнено':'не выполнено'}`} aria-pressed={isDone} disabled={busy||data.date>data.today||!isScheduled} onClick={()=>perform('/api/marks','PUT',{habitId:habit.id,date:data.date,done:!isDone})}><span className="habit-icon">{habit.icon||'✨'}</span><span><strong>{habit.name}</strong><small>{isScheduled?scheduleLabels[habit.schedule]||scheduleLabels.daily:'Сегодня не запланировано'}</small></span><span className="habit-check-big">{isDone?<Check size={18}/>:null}</span></button><button className="habit-settings" aria-label={`Настроить привычку ${habit.name}`} onClick={()=>openEdit(habit)}><Pencil size={15}/></button></div><div className="habit-calendar" aria-label={`Последние 14 дней: ${habit.name}`}>{Array.from({length:14},(_,index)=>plusDays(data.date,-13+index)).map(date=>{const isHabitDay=scheduled(habit,date),marked=done.has(keyFor(habit,date));return <span className={!isHabitDay?'skip':marked?'done':''} title={`${date}: ${!isHabitDay?'не запланировано':marked?'выполнено':'нет отметки'}`} key={date}>{atNoon(date).getUTCDate()}</span>})}</div><div className="habit-card-foot"><span><Flame size={14}/>{currentStreak} {ending(currentStreak,'день','дня','дней')}</span><span>{weekDone}/{habit.weeklyTarget||7} на этой неделе</span></div></article>})}</div>}<ErrorMessage error={error}/>{editor&&<HabitEditor habit={current} close={()=>{setEditor(null);setCurrent(null)}} remove={async()=>{if(!current)return;await perform(`/api/habits/${current.id}`,'DELETE',{});setEditor(null)}} mutate={mutate} busy={busy}/>}</section>
}

function HabitEditor({habit,close,remove,mutate,busy}:{habit:Habit|null;close:()=>void;remove:()=>Promise<void>;mutate:Mutate;busy:boolean}) {
  const [error,setError]=useState('')
  const [icon,setIcon]=useState(habit?.icon||'✨')
  const [saving,setSaving]=useState(false)
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=new FormData(event.currentTarget);setSaving(true);setError('')
    try { await mutate(habit?`/api/habits/${habit.id}`:'/api/habits',habit?'PUT':'POST',{name:form.get('name'),icon,schedule:form.get('schedule'),weeklyTarget:Number(form.get('weeklyTarget'))});close() }
    catch(reason) { setError(errorText(reason)) }
    finally { setSaving(false) }
  }
  return <Dialog title={habit?'Настроить привычку':'Новая привычка'} close={close}>
    <form className="workspace-form habit-form" onSubmit={submit}>
      <label>Название<input name="name" defaultValue={habit?.name} placeholder="Например, прогулка после обеда" maxLength={80} required autoFocus/></label>
      <label>Иконка<div className="icon-palette">{['💧','🌙','🚶','🧘','🥗','📵','🏋️','📚','🌿','✨'].map(value=><button type="button" className={icon===value?'selected':''} onClick={()=>setIcon(value)} key={value}>{value}</button>)}</div></label>
      <label>Когда повторять<select name="schedule" defaultValue={habit?.schedule||'daily'}><option value="daily">Каждый день</option><option value="weekdays">По будням</option><option value="weekends">По выходным</option></select></label>
      <label>Цель на неделю<select name="weeklyTarget" defaultValue={habit?.weeklyTarget||7}>{[1,2,3,4,5,6,7].map(value=><option value={value} key={value}>{value} {ending(value,'день','дня','дней')}</option>)}</select></label>
      <ErrorMessage error={error}/>
      <button className="primary-button" disabled={busy||saving}>{habit?'Сохранить настройки':'Добавить привычку'}</button>
      {habit&&<button type="button" className="text-button danger habit-remove" disabled={busy||saving} onClick={()=>remove().catch(reason=>setError(errorText(reason)))}><X size={15}/>Убрать привычку</button>}
    </form>
  </Dialog>
}function ending(value:number,one:string,few:string,many:string){const tail=value%100;if(tail>10&&tail<20)return many;const last=value%10;return last===1?one:last>1&&last<5?few:many}
