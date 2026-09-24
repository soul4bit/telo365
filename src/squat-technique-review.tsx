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

function ReviewScene({state}:{state:ReviewState}){
  return <Canvas className="squat-technique-review-canvas" shadows frameloop="demand" dpr={[1,1]} camera={{position:cameraPositions[state.view],fov:30}} gl={{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:.82,outputColorSpace:THREE.SRGBColorSpace}}>
    <color attach="background" args={['#f7faf5']}/>
    <hemisphereLight args={['#fcfdf9','#d7e4d2',1.05]}/><ambientLight intensity={.34}/>
    <directionalLight castShadow position={[3.4,5.2,3.1]} intensity={1.05} color="#fffdf7" shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-.00025} shadow-radius={3}/>
    <directionalLight position={[-3.5,2.4,1.5]} intensity={.25} color="#e8f0e4"/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.061,0]} receiveShadow><circleGeometry args={[2.8,64]}/><meshStandardMaterial color="#e4ebe1" roughness={1} metalness={0}/></mesh>
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
