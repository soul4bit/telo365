import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TechniqueDialog } from './components/Workouts'
import type { ExerciseMedia } from './api'
import type { TrainerAvatar } from './exercise3d'
import './styles.css'
import './workspace.css'

const copy={
  unavailable:'\u042d\u0442\u043e\u0442 preview \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e \u0432 \u0440\u0435\u0436\u0438\u043c\u0435 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0438.',
  eyebrow:'\u041b\u041e\u041a\u0410\u041b\u042c\u041d\u042b\u0419 PREVIEW',title:'\u0422\u0435\u0445\u043d\u0438\u043a\u0430 \u043f\u0440\u0438\u0441\u0435\u0434\u0430\u043d\u0438\u0439 \u00b7 Mixamo',description:'\u041c\u043e\u0434\u0430\u043b\u044c\u043d\u043e\u0435 \u043e\u043a\u043d\u043e \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 \u0442\u043e\u0442 \u0436\u0435 \u043a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442, \u0447\u0442\u043e \u0438 \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a. \u041e\u043d\u043e \u043d\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u043e\u0431\u044b\u0447\u043d\u044b\u043c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f\u043c.',open:'\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0442\u0435\u0441\u0442\u043e\u0432\u0443\u044e \u043c\u043e\u0434\u0430\u043b\u043a\u0443',squat:'\u041f\u0440\u0438\u0441\u0435\u0434\u0430\u043d\u0438\u044f'
}
const localDeveloperPreview=['localhost','127.0.0.1'].includes(window.location.hostname)
const developerMode=new URLSearchParams(window.location.search).get('mode')==='developer'
const initialFrameMode=new URLSearchParams(window.location.search).get('frame')==='initial'
const emptyMedia:ExerciseMedia={shortVideoUrl:null,posterUrl:null,duration:null,angle:null,trainerName:null}

function MixamoSquatTechniqueDialogPreview(){
  const [open,setOpen]=useState(true)
  const [avatar,setAvatar]=useState<TrainerAvatar>('female')
  if(!localDeveloperPreview)return <main className="workspace"><p className="form-note">{copy.unavailable}</p></main>
  return <main className="workspace mixamo-technique-preview-page" style={{minHeight:'100vh',padding:'32px'}}>
    <section className="workspace-card" style={{maxWidth:640,padding:24}}>
      <span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p className="muted-copy">{copy.description}</p>
      {!open&&<button className="soft-button" onClick={()=>setOpen(true)}>{copy.open}</button>}
    </section>
    {open&&<TechniqueDialog item={{exerciseId:'squat',name:copy.squat,media:emptyMedia}} trainerAvatar={avatar} setTrainerAvatar={setAvatar} enableMixamoPreview={developerMode} initialViewerMode={developerMode?'mixamo':'technique'} startPaused={initialFrameMode} close={()=>setOpen(false)}/>}
  </main>
}

createRoot(document.getElementById('root')!).render(<MixamoSquatTechniqueDialogPreview />)
