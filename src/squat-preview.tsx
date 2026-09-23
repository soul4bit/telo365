import { createRoot } from 'react-dom/client'
import Exercise3DViewer from './components/Exercise3DViewer'
import './workspace.css'

function SquatPreview(){
  return <main className="workspace" style={{minHeight:'100vh',padding:'32px',display:'grid',placeItems:'center'}}>
    <section className="workspace-card" style={{width:'min(960px, 100%)',boxSizing:'border-box',padding:'24px'}}>
      <p className="eyebrow">ПРОВЕРКА АССЕТА · НЕ ЧАСТЬ ПРОДУКТОВОГО UI</p>
      <h1 style={{marginTop:0}}>Мужской риг · приседание</h1>
      <Exercise3DViewer
        modelUrl="/media/exercises/models/telo-trainer-male-rig-test.glb"
        animationUrl="/media/exercises/animations/male/squat-test.glb"
        animationClip="squat"
        cameraPreset="threeQuarter"
        playbackSpeed={1}
        posterUrl="/media/exercises/poster-placeholder.svg"
        requireSkinnedMesh
      />
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<SquatPreview />)
