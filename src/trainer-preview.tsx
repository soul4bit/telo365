import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Exercise3DViewer from './components/Exercise3DViewer'
import type { ExerciseCameraPreset } from './exercise3d'
import './workspace.css'

type Avatar='male'|'female'
type ExerciseManifest={
  exerciseId:string
  name:string
  cameraPreset:ExerciseCameraPreset
  animation:{clip:string}
  avatars:Record<Avatar,{animationGlb:string;technicalStatus:string}>
  reviews:{technical:string;visual:string;specialistTechnique:string;readyForPublication:boolean}
}
type CharacterManifest={characters:Record<Avatar,{label:string;modelGlb:string}>}

const exercises=Object.values(import.meta.glob('../trainer/exercises/*.json',{eager:true,import:'default'}) as Record<string,ExerciseManifest>)
  .filter(item=>item?.exerciseId&&item.avatars?.male&&item.avatars?.female)
  .sort((left,right)=>left.exerciseId.localeCompare(right.exerciseId))
const characterEntries=Object.values(import.meta.glob('../trainer/characters.manifest.json',{eager:true,import:'default'}) as Record<string,CharacterManifest>)
const characters=characterEntries[0]

function TrainerPreview(){
  const [exerciseId,setExerciseId]=useState(exercises.find(item=>item.exerciseId==='squat')?.exerciseId||exercises[0]?.exerciseId||'')
  const [avatar,setAvatar]=useState<Avatar>('male')
  const exercise=useMemo(()=>exercises.find(item=>item.exerciseId===exerciseId),[exerciseId])
  if(!exercise||!characters)return <main className="workspace"><p>Манифесты 3D-тренеров не найдены.</p></main>
  const source=exercise.avatars[avatar]
  const available=source.technicalStatus==='passed'
  return <main className="workspace" style={{minHeight:'100vh',padding:'32px',display:'grid',placeItems:'center'}}>
    <section className="workspace-card" style={{width:'min(1000px, 100%)',boxSizing:'border-box',padding:'24px'}}>
      <p className="eyebrow">ПРОВЕРКА АССЕТА · НЕ ЧАСТЬ PRODUCTION UI</p>
      <div className="trainer-preview-toolbar">
        <label>Упражнение<select value={exercise.exerciseId} onChange={event=>setExerciseId(event.target.value)}>{exercises.map(item=><option key={item.exerciseId} value={item.exerciseId}>{item.name} · {item.exerciseId}</option>)}</select></label>
        <div className="trainer-avatar-switch"><span>Тестовый тренер</span><div role="group" aria-label="Выбор тестового 3D-тренера">{(['male','female'] as Avatar[]).map(id=><button key={id} type="button" aria-pressed={avatar===id} className={avatar===id?'is-active':''} onClick={()=>setAvatar(id)}>{characters.characters[id].label}</button>)}</div></div>
      </div>
      <h1 style={{marginTop:0}}>{exercise.name} · {characters.characters[avatar].label}</h1>
      <p className="muted-copy">Технический статус: {source.technicalStatus}. Визуальная и специалистская проверка: {exercise.reviews.visual} / {exercise.reviews.specialistTechnique}.</p>
      {available?<Exercise3DViewer modelUrl={`/${characters.characters[avatar].modelGlb.replace(/^public\//,'')}`} animationUrl={`/${source.animationGlb.replace(/^public\//,'')}`} animationClip={exercise.animation.clip} cameraPreset={exercise.cameraPreset} playbackSpeed={1} posterUrl="/media/exercises/poster-placeholder.svg" requireSkinnedMesh/>:<div className="exercise-3d-fallback"><div><strong>Анимация для этого тренера ещё не подготовлена</strong><p>Создай отдельный clip, проверь его и запусти trainer:verify. Production viewer не изменяется.</p></div></div>}
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<TrainerPreview />)
