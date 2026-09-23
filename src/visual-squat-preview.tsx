import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import Exercise3DViewer from './components/Exercise3DViewer'
import './workspace.css'

const candidates={
  male:{label:'Мужчина',modelUrl:'/media/exercises/models/telo-trainer-male-visual-test.glb',animationUrl:'/media/exercises/animations/male/squat-test.glb'},
  female:{label:'Женщина',modelUrl:'/media/exercises/models/telo-trainer-female-visual-test.glb',animationUrl:'/media/exercises/animations/female/squat-test.glb'}
} as const

function VisualSquatPreview(){
  const [avatar,setAvatar]=useState<keyof typeof candidates>('male')
  const candidate=candidates[avatar]
  return <main className="workspace" style={{minHeight:'100vh',padding:'32px',display:'grid',placeItems:'center'}}>
    <section className="workspace-card" style={{width:'min(960px, 100%)',boxSizing:'border-box',padding:'24px'}}>
      <p className="eyebrow">VISUAL CANDIDATE · НЕ ЧАСТЬ PRODUCTION UI</p>
      <div className="trainer-avatar-switch"><span>Тестовый тренер</span><div role="group" aria-label="Выбор визуального 3D-тренера">{(Object.keys(candidates) as Array<keyof typeof candidates>).map(id=><button key={id} type="button" aria-pressed={avatar===id} className={avatar===id?'is-active':''} onClick={()=>setAvatar(id)}>{candidates[id].label}</button>)}</div></div>
      <h1 style={{marginTop:0}}>{candidate.label} · приседание</h1>
      <p className="muted-copy">Отдельная одежда и материалы проверяются вместе с существующим четырёхсекундным squat-клипом. Кандидат не утверждён и не включён в тренировочный интерфейс.</p>
      <Exercise3DViewer modelUrl={candidate.modelUrl} animationUrl={candidate.animationUrl} animationClip="squat" cameraPreset="threeQuarter" playbackSpeed={1} posterUrl="/media/exercises/poster-placeholder.svg" requireSkinnedMesh/>
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<VisualSquatPreview />)
