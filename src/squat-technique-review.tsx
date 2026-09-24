import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { isLocalReviewEnvironment, localReviewAssetUrl } from './local-review-assets'
import './workspace.css'

type Avatar = 'male'|'female'
type View = 'front'|'side'|'back'|'three-quarter'
type ReviewState = {avatar:Avatar;view:View;time:number;diagnostic:boolean}

declare global {
  interface Window {
    __teloSquatTechniqueReview?:{
      set:(next:Partial<ReviewState>)=>void
      status:()=>{state:ReviewState}
    }
  }
}

const assets:Record<Avatar,{path:string;label:string}>={
  male:{path:'models/mixamo-male-air-squat-combined-test.glb',label:'Mixamo CH08_NONPBR'},
  female:{path:'models/mixamo-female-air-squat-combined-test.glb',label:'Mixamo Jody'}
}

const cameraPositions:Record<View,[number,number,number]>={
  front:[0,.12,4.35],
  side:[4.35,.12,0],
  back:[0,.12,-4.35],
  'three-quarter':[3.08,.18,3.08]
}
const cameraTarget=new THREE.Vector3(0,-.06,0)

function Camera({view}:{view:View}){
  const {camera,invalidate}=useThree()
  useLayoutEffect(()=>{
    camera.position.set(...cameraPositions[view])
    camera.lookAt(cameraTarget)
    camera.updateProjectionMatrix()
    invalidate()
  },[camera,invalidate,view])
  return null
}

function findBone(scene:THREE.Object3D,suffix:string){
  let found:THREE.Bone|undefined
  scene.traverse(node=>{
    if(!found&&(node as THREE.Bone).isBone&&node.name.endsWith(suffix))found=node as THREE.Bone
  })
  return found
}

function DiagnosticMarkers({scene}:{scene:THREE.Object3D}){
  const hips=useMemo(()=>findBone(scene,'Hips'),[scene])
  const leftKnee=useMemo(()=>findBone(scene,'LeftLeg'),[scene])
  const rightKnee=useMemo(()=>findBone(scene,'RightLeg'),[scene])
  const leftFoot=useMemo(()=>findBone(scene,'LeftFoot'),[scene])
  const rightFoot=useMemo(()=>findBone(scene,'RightFoot'),[scene])
  const leftToe=useMemo(()=>findBone(scene,'LeftToeBase'),[scene])
  const rightToe=useMemo(()=>findBone(scene,'RightToeBase'),[scene])
  const hipMarker=useRef<THREE.Mesh>(null),leftKneeMarker=useRef<THREE.Mesh>(null),rightKneeMarker=useRef<THREE.Mesh>(null)
  const leftDirection=useMemo(()=>new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),.34,'#3f8c5d',.1,.06),[])
  const rightDirection=useMemo(()=>new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),.34,'#3f8c5d',.1,.06),[])
  useEffect(()=>{
    for(const helper of [leftDirection,rightDirection])helper.traverse(node=>{
      const material=(node as THREE.Mesh|THREE.Line).material as THREE.Material|THREE.Material[]|undefined
      for(const item of Array.isArray(material)?material:material?[material]:[]){item.depthTest=false;item.depthWrite=false}
    })
  },[leftDirection,rightDirection])
  useFrame(()=>{
    const point=new THREE.Vector3(),toe=new THREE.Vector3(),direction=new THREE.Vector3()
    const position=(bone:THREE.Bone|undefined,marker:React.RefObject<THREE.Mesh|null>)=>{
      if(bone&&marker.current){bone.getWorldPosition(point);marker.current.position.copy(point)}
    }
    position(hips,hipMarker);position(leftKnee,leftKneeMarker);position(rightKnee,rightKneeMarker)
    const arrow=(foot:THREE.Bone|undefined,toeBone:THREE.Bone|undefined,helper:THREE.ArrowHelper)=>{
      if(!foot||!toeBone)return
      foot.getWorldPosition(point);toeBone.getWorldPosition(toe)
      direction.subVectors(toe,point)
      if(direction.lengthSq()<1e-7)return
      helper.position.copy(point);helper.setDirection(direction.normalize());helper.setLength(.34,.1,.06)
    }
    arrow(leftFoot,leftToe,leftDirection);arrow(rightFoot,rightToe,rightDirection)
  })
  return <>
    <gridHelper args={[3.8,16,'#93aa90','#c8d8c5']} position={[0,-1.06,0]}/>
    <mesh ref={hipMarker} renderOrder={2}><sphereGeometry args={[.066,20,16]}/><meshBasicMaterial color="#ce5b54" depthTest={false} depthWrite={false}/></mesh>
    <mesh ref={leftKneeMarker} renderOrder={2}><sphereGeometry args={[.055,20,16]}/><meshBasicMaterial color="#3e79bd" depthTest={false} depthWrite={false}/></mesh>
    <mesh ref={rightKneeMarker} renderOrder={2}><sphereGeometry args={[.055,20,16]}/><meshBasicMaterial color="#d49a30" depthTest={false} depthWrite={false}/></mesh>
    <primitive object={leftDirection}/><primitive object={rightDirection}/>
  </>
}

function ReviewAvatar({avatar,time,diagnostic}:{avatar:Avatar;time:number;diagnostic:boolean}){
  const url=localReviewAssetUrl(assets[avatar].path)!
  const gltf=useLoader(GLTFLoader,url)
  const scene=useMemo(()=>cloneSkeleton(gltf.scene),[gltf.scene])
  const mixer=useMemo(()=>new THREE.AnimationMixer(scene),[scene])
  const clip=useMemo(()=>gltf.animations.find(item=>item.name==='squat'),[gltf.animations])
  const action=useMemo(()=>clip?mixer.clipAction(clip):null,[clip,mixer])
  const {invalidate}=useThree()

  if(!clip||!action)throw new Error(`Original squat clip is missing for ${avatar}`)

  useEffect(()=>{
    scene.traverse(node=>{
      const mesh=node as THREE.Mesh
      if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true}
    })
    return()=>{action.stop();mixer.stopAllAction();mixer.uncacheAction(clip,scene);mixer.uncacheRoot(scene)}
  },[action,clip,mixer,scene])

  useLayoutEffect(()=>{
    action.reset().setLoop(THREE.LoopOnce,1).play()
    // AnimationMixer does not evaluate interpolants when set to absolute zero:
    // it would show the bind pose rather than the first authored source key.
    // One microsecond is visually identical to each endpoint but forces the
    // original Mixamo track to be evaluated for deterministic review frames.
    const endpointEpsilon=.000001
    const requested=THREE.MathUtils.clamp(time,0,clip.duration)
    const evaluatedTime=requested<=0?endpointEpsilon:requested>=clip.duration?clip.duration-endpointEpsilon:requested
    mixer.setTime(evaluatedTime)
    action.paused=true
    scene.updateMatrixWorld(true)
    invalidate()
  },[action,clip.duration,invalidate,mixer,time])

  return <>
    <group position={[0,-1.05,0]}><primitive object={scene}/></group>
    {diagnostic&&<DiagnosticMarkers scene={scene}/>}
  </>
}

function StudioPanel({position,rotation,width}:{position:[number,number,number];rotation?:[number,number,number];width:number}){
  return <group position={position} rotation={rotation||[0,0,0]}>
    <mesh><boxGeometry args={[width,2.2,.035]}/><meshStandardMaterial color="#c8d9d0" roughness={.3} metalness={.12}/></mesh>
    <mesh position={[0,1.12,.025]}><boxGeometry args={[width+.11,.07,.075]}/><meshStandardMaterial color="#b4c9b0" roughness={.65}/></mesh>
    <mesh position={[0,-1.12,.025]}><boxGeometry args={[width+.11,.07,.075]}/><meshStandardMaterial color="#b4c9b0" roughness={.65}/></mesh>
    <mesh position={[-width/2-.02,0,.025]}><boxGeometry args={[.07,2.3,.075]}/><meshStandardMaterial color="#b4c9b0" roughness={.65}/></mesh>
    <mesh position={[width/2+.02,0,.025]}><boxGeometry args={[.07,2.3,.075]}/><meshStandardMaterial color="#b4c9b0" roughness={.65}/></mesh>
  </group>
}

function GymRack({position,rotation=[0,0,0]}:{position:[number,number,number];rotation?:[number,number,number]}){
  const metal='#526d57'
  return <group position={position} rotation={rotation}>
    <mesh position={[-.72,.78,0]} castShadow><boxGeometry args={[.1,1.85,.1]}/><meshStandardMaterial color={metal} roughness={.55}/></mesh>
    <mesh position={[.72,.78,0]} castShadow><boxGeometry args={[.1,1.85,.1]}/><meshStandardMaterial color={metal} roughness={.55}/></mesh>
    <mesh position={[0,1.58,0]} castShadow><boxGeometry args={[1.6,.08,.12]}/><meshStandardMaterial color={metal} roughness={.55}/></mesh>
    <mesh position={[0,.18,0]} castShadow><boxGeometry args={[1.76,.12,.35]}/><meshStandardMaterial color="#799477" roughness={.68}/></mesh>
    {[-.52,-.26,0,.26,.52].map(x=><mesh key={x} position={[x,.38,-.03]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.11,.11,.17,12]}/><meshStandardMaterial color="#3d5e44" roughness={.48}/></mesh>)}
  </group>
}

/** A restrained gym interior rendered only into review frames and final WebM.
 * It is intentionally built from simple room and equipment forms, never from
 * another character or a downloadable third-party asset. */
function GymInterior(){
  const wall='#eef3eb',accent='#d2e0ce',rubber='#d2ddd0',metal='#5d7561',bench='#789378'
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.06,0]} receiveShadow><planeGeometry args={[10,10]}/><meshStandardMaterial color={rubber} roughness={.94}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.055,0]} receiveShadow><planeGeometry args={[3.7,5.1]}/><meshStandardMaterial color="#c3d3bf" roughness={.9}/></mesh>
    <gridHelper args={[9.8,14,'#b5cbb2','#d6e2d2']} position={[0,-1.05,0]}/>
    <mesh position={[0,.82,-5]} receiveShadow><boxGeometry args={[10,3.8,.12]}/><meshStandardMaterial color={wall} roughness={.96}/></mesh>
    <mesh position={[0,.82,5]} rotation={[0,Math.PI,0]} receiveShadow><boxGeometry args={[10,3.8,.12]}/><meshStandardMaterial color={wall} roughness={.96}/></mesh>
    <mesh position={[-5,.82,0]} rotation={[0,Math.PI/2,0]} receiveShadow><boxGeometry args={[10,3.8,.12]}/><meshStandardMaterial color={wall} roughness={.96}/></mesh>
    <mesh position={[5,.82,0]} rotation={[0,-Math.PI/2,0]} receiveShadow><boxGeometry args={[10,3.8,.12]}/><meshStandardMaterial color={wall} roughness={.96}/></mesh>
    <mesh position={[0,2.68,-4.91]}><boxGeometry args={[9.2,.12,.06]}/><meshStandardMaterial color={accent} roughness={.8}/></mesh>
    <mesh position={[0,2.68,4.91]}><boxGeometry args={[9.2,.12,.06]}/><meshStandardMaterial color={accent} roughness={.8}/></mesh>
    <StudioPanel position={[0,.72,-4.9]} width={3.25}/><StudioPanel position={[0,.72,4.9]} rotation={[0,Math.PI,0]} width={3.25}/>
    <StudioPanel position={[-4.9,.72,0]} rotation={[0,Math.PI/2,0]} width={3.25}/><StudioPanel position={[4.9,.72,0]} rotation={[0,-Math.PI/2,0]} width={3.25}/>
    <GymRack position={[-3.35,.1,-4.72]}/><GymRack position={[3.35,.1,-4.72]}/>
    <GymRack position={[-3.35,.1,4.72]} rotation={[0,Math.PI,0]}/><GymRack position={[3.35,.1,4.72]} rotation={[0,Math.PI,0]}/>
    <GymRack position={[-4.72,.1,-2.75]} rotation={[0,Math.PI/2,0]}/><GymRack position={[-4.72,.1,2.75]} rotation={[0,Math.PI/2,0]}/>
    <group position={[3.35,-.72,-3.3]} rotation={[0,-.28,0]}>
      <mesh position={[0,.32,0]} castShadow><boxGeometry args={[1.3,.13,.42]}/><meshStandardMaterial color={bench} roughness={.72}/></mesh>
      <mesh position={[-.5,0,0]} rotation={[0,0,.3]} castShadow><boxGeometry args={[.09,.7,.09]}/><meshStandardMaterial color={metal} roughness={.5}/></mesh>
      <mesh position={[.5,0,0]} rotation={[0,0,-.3]} castShadow><boxGeometry args={[.09,.7,.09]}/><meshStandardMaterial color={metal} roughness={.5}/></mesh>
    </group>
    <group position={[-3.25,.25,3.8]} rotation={[0,.45,0]}>
      <mesh position={[0,.2,0]} castShadow><boxGeometry args={[1.25,.12,.44]}/><meshStandardMaterial color="#759071" roughness={.7}/></mesh>
      {[-.42,-.14,.14,.42].map(x=><mesh key={x} position={[x,.48,0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.14,.14,.2,12]}/><meshStandardMaterial color="#49664c" roughness={.48}/></mesh>)}
    </group>
    <mesh position={[0,2.7,0]} receiveShadow><boxGeometry args={[8.5,.08,8.5]}/><meshStandardMaterial color="#f5f9f2" roughness={1}/></mesh>
  </group>
}

function ReviewScene({state}:{state:ReviewState}){
  return <Canvas className="squat-technique-review-canvas" shadows frameloop="demand" dpr={[1,1]} camera={{position:cameraPositions[state.view],fov:30}} gl={{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:.82,outputColorSpace:THREE.SRGBColorSpace}}>
    <color attach="background" args={['#eaf1e6']}/>
    <hemisphereLight args={['#fcfdf9','#d7e4d2',1.05]}/><ambientLight intensity={.34}/>
    <directionalLight castShadow position={[3.4,5.2,3.1]} intensity={1.05} color="#fffdf7" shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-.00025} shadow-radius={3}/>
    <directionalLight position={[-3.5,2.4,1.5]} intensity={.25} color="#e8f0e4"/>
    <GymInterior/>
    <Suspense fallback={null}><ReviewAvatar key={state.avatar} {...state}/></Suspense>
    <Camera view={state.view}/>
  </Canvas>
}

function ReviewApp(){
  const requestedAvatar=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('avatar'):null
  const initialAvatar:Avatar=requestedAvatar==='female'?'female':'male'
  const [state,setState]=useState<ReviewState>({avatar:initialAvatar,view:'three-quarter',time:0,diagnostic:false})
  useEffect(()=>{
    window.__teloSquatTechniqueReview={
      set:next=>{
        setState(current=>({...current,...next,time:typeof next.time==='number'?Math.max(0,next.time):current.time}))
      },
      status:()=>({state})
    }
    return()=>{delete window.__teloSquatTechniqueReview}
  },[state])
  if(!isLocalReviewEnvironment())return <main className="squat-technique-review-unavailable">Локальный review доступен только через Vite на этом компьютере.</main>
  return <main className="squat-technique-review-root" data-review-avatar={state.avatar} data-review-view={state.view} data-review-time={state.time.toFixed(5)}>
    <section className="squat-technique-review-stage">
      <ReviewScene state={state}/>
      {state.diagnostic&&<div className="squat-technique-review-legend"><strong>Диагностические ориентиры</strong><span><i className="pelvis"/>таз</span><span><i className="left-knee"/>левое колено</span><span><i className="right-knee"/>правое колено</span><span><i className="foot"/>направление стоп</span></div>}
    </section>
    <p className="squat-technique-review-caption">{assets[state.avatar].label} · Air Squat · {state.view} · {state.time.toFixed(3)} с</p>
  </main>
}

createRoot(document.getElementById('root')!).render(<ReviewApp/>)
