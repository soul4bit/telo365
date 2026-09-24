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

function BrandPlaque({position,rotation=[0,0,0]}:{position:[number,number,number];rotation?:[number,number,number]}){
  const map=useMemo(()=>{
    const canvas=document.createElement('canvas')
    canvas.width=1024;canvas.height=256
    const context=canvas.getContext('2d')!
    context.fillStyle='#d7c8ac';context.fillRect(0,0,canvas.width,canvas.height)
    context.fillStyle='#30473a';context.font='700 106px Arial, sans-serif';context.textAlign='center';context.textBaseline='middle'
    context.fillText('TELO365.RU',canvas.width/2,canvas.height/2+4)
    const texture=new THREE.CanvasTexture(canvas)
    texture.colorSpace=THREE.SRGBColorSpace
    return texture
  },[])
  useEffect(()=>()=>map.dispose(),[map])
  return <mesh position={position} rotation={rotation} castShadow><planeGeometry args={[1.68,.42]}/><meshBasicMaterial map={map} toneMapped={false}/></mesh>
}

function DarkWall({position,rotation=[0,0,0],width=10}:{position:[number,number,number];rotation?:[number,number,number];width?:number}){
  return <group position={position} rotation={rotation}>
    <mesh receiveShadow><boxGeometry args={[width,3.85,.14]}/><meshStandardMaterial color="#657064" roughness={.92}/></mesh>
    <mesh position={[0,1.56,.078]}><boxGeometry args={[width,.07,.03]}/><meshStandardMaterial color="#8b9a87" roughness={.68}/></mesh>
  </group>
}

function WoodSlats({position,rotation=[0,0,0],count=13,width=2.05}:{position:[number,number,number];rotation?:[number,number,number];count?:number;width?:number}){
  return <group position={position} rotation={rotation}>
    <mesh position={[0,.64,-.015]}><boxGeometry args={[width,2.62,.045]}/><meshStandardMaterial color="#292f2a" roughness={.82}/></mesh>
    {Array.from({length:count},(_,index)=>{
      const x=-width/2+(index+.5)*width/count
      return <mesh key={index} position={[x,.64,.025]} castShadow><boxGeometry args={[width/count*.58,2.58,.06]}/><meshStandardMaterial color={index%2?'#755a3e':'#8b6e4e'} roughness={.76}/></mesh>
    })}
  </group>
}

function StudioWindow({position,rotation=[0,0,0]}:{position:[number,number,number];rotation?:[number,number,number]}){
  const frame='#1d2521'
  return <group position={position} rotation={rotation}>
    <mesh><planeGeometry args={[2.6,2.42]}/><meshBasicMaterial color="#b8af94" toneMapped={false}/></mesh>
    <mesh position={[0,0,.03]}><boxGeometry args={[2.74,.1,.1]}/><meshStandardMaterial color={frame} roughness={.55} metalness={.6}/></mesh>
    <mesh position={[0,1.17,.03]}><boxGeometry args={[2.74,.1,.1]}/><meshStandardMaterial color={frame} roughness={.55} metalness={.6}/></mesh>
    <mesh position={[-1.32,.59,.03]}><boxGeometry args={[.1,2.5,.1]}/><meshStandardMaterial color={frame} roughness={.55} metalness={.6}/></mesh>
    <mesh position={[1.32,.59,.03]}><boxGeometry args={[.1,2.5,.1]}/><meshStandardMaterial color={frame} roughness={.55} metalness={.6}/></mesh>
    <mesh position={[0,.59,.04]}><boxGeometry args={[.055,2.36,.08]}/><meshStandardMaterial color={frame} roughness={.55} metalness={.6}/></mesh>
    <mesh position={[0,.59,.05]}><boxGeometry args={[2.56,.055,.08]}/><meshStandardMaterial color={frame} roughness={.55} metalness={.6}/></mesh>
  </group>
}

function GymRack({position,rotation=[0,0,0]}:{position:[number,number,number];rotation?:[number,number,number]}){
  const metal='#202723',accent='#617b68'
  return <group position={position} rotation={rotation}>
    {[-.78,.78].map(x=><mesh key={x} position={[x,.86,0]} castShadow><boxGeometry args={[.105,2.1,.105]}/><meshStandardMaterial color={metal} roughness={.48} metalness={.68}/></mesh>)}
    <mesh position={[0,1.88,0]} castShadow><boxGeometry args={[1.66,.1,.13]}/><meshStandardMaterial color={metal} roughness={.48} metalness={.68}/></mesh>
    <mesh position={[0,.14,0]} castShadow><boxGeometry args={[1.86,.12,.5]}/><meshStandardMaterial color={metal} roughness={.58} metalness={.55}/></mesh>
    <mesh position={[0,1.32,.09]} castShadow><cylinderGeometry args={[.035,.035,1.78,12]}/><meshStandardMaterial color={accent} roughness={.34} metalness={.7}/></mesh>
  </group>
}

function DumbbellRack({position,rotation=[0,0,0]}:{position:[number,number,number];rotation?:[number,number,number]}){
  const metal='#202723'
  return <group position={position} rotation={rotation}>
    <mesh position={[0,.22,0]} castShadow><boxGeometry args={[1.82,.08,.42]}/><meshStandardMaterial color={metal} roughness={.5} metalness={.6}/></mesh>
    <mesh position={[0,.7,0]} castShadow><boxGeometry args={[1.66,.08,.38]}/><meshStandardMaterial color={metal} roughness={.5} metalness={.6}/></mesh>
    {[-.62,-.31,0,.31,.62].map((x,index)=><group key={x} position={[x,.85,0]} rotation={[0,0,Math.PI/2]}><mesh castShadow><cylinderGeometry args={[.035,.035,.28,12]}/><meshStandardMaterial color="#87908a" roughness={.32} metalness={.72}/></mesh><mesh position={[0,.16,0]} castShadow><cylinderGeometry args={[.11,.11,.12,16]}/><meshStandardMaterial color={index%2?'#303832':'#3d4d42'} roughness={.45} metalness={.38}/></mesh><mesh position={[0,-.16,0]} castShadow><cylinderGeometry args={[.11,.11,.12,16]}/><meshStandardMaterial color={index%2?'#303832':'#3d4d42'} roughness={.45} metalness={.38}/></mesh></group>)}
    {[-.65,.65].map(x=><mesh key={x} position={[x,.37,0]} rotation={[0,0,x<0?.35:-.35]} castShadow><boxGeometry args={[.07,.72,.07]}/><meshStandardMaterial color={metal} roughness={.5} metalness={.6}/></mesh>)}
  </group>
}

function Kettlebell({position,color='#33483b'}:{position:[number,number,number];color?:string}){
  return <group position={position}><mesh castShadow><sphereGeometry args={[.22,20,16]}/><meshStandardMaterial color={color} roughness={.48} metalness={.18}/></mesh><mesh position={[0,.2,0]} castShadow><torusGeometry args={[.11,.035,10,18]}/><meshStandardMaterial color={color} roughness={.48} metalness={.18}/></mesh></group>
}

function PlyoBox({position,rotation=[0,0,0]}:{position:[number,number,number];rotation?:[number,number,number]}){
  return <group position={position} rotation={rotation}><mesh castShadow receiveShadow><boxGeometry args={[.86,.72,.86]}/><meshStandardMaterial color="#9b7a54" roughness={.8}/></mesh><mesh position={[0,.365,0]} castShadow><boxGeometry args={[.93,.04,.93]}/><meshStandardMaterial color="#b39168" roughness={.74}/></mesh><BrandPlaque position={[0,.02,.436]} rotation={[0,0,0]}/></group>
}

function Plant({position}:{position:[number,number,number]}){
  return <group position={position}><mesh castShadow><cylinderGeometry args={[.22,.27,.32,16]}/><meshStandardMaterial color="#b48e62" roughness={.86}/></mesh>{Array.from({length:9},(_,index)=>{const angle=index/9*Math.PI*2;return <mesh key={index} position={[Math.sin(angle)*.16,.42,Math.cos(angle)*.16]} rotation={[.4,angle,.25]} castShadow><sphereGeometry args={[.15,.1,12,8]}/><meshStandardMaterial color={index%2?'#3f674a':'#577d56'} roughness={.76}/></mesh>})}</group>
}

/** This physical room is rendered into review frames and final WebM only.
 * It never becomes a runtime CSS background and is shared by every view/avatar. */
function GymInterior(){
  const rubber='#343a36',tile='#4a514a'
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.06,0]} receiveShadow><planeGeometry args={[10,10]}/><meshStandardMaterial color={rubber} roughness={.96}/></mesh>
    {[-3,-1.5,0,1.5,3].flatMap(value=>[
      <mesh key={`x${value}`} rotation={[-Math.PI/2,0,0]} position={[value,-1.055,0]}><planeGeometry args={[.016,9.8]}/><meshBasicMaterial color={tile}/></mesh>,
      <mesh key={`z${value}`} rotation={[-Math.PI/2,0,0]} position={[0,-1.055,value]}><planeGeometry args={[9.8,.016]}/><meshBasicMaterial color={tile}/></mesh>
    ])}
    <DarkWall position={[0,.82,-4.92]}/><DarkWall position={[0,.82,4.92]} rotation={[0,Math.PI,0]}/><DarkWall position={[-4.92,.82,0]} rotation={[0,Math.PI/2,0]}/><DarkWall position={[4.92,.82,0]} rotation={[0,-Math.PI/2,0]}/>
    <WoodSlats position={[1.7,.18,-4.82]} width={2.18}/><StudioWindow position={[-2.85,.15,-4.82]}/><BrandPlaque position={[.1,1.36,-4.81]}/>
    <WoodSlats position={[-4.82,.18,-2.55]} rotation={[0,Math.PI/2,0]} width={1.9}/><WoodSlats position={[4.82,.18,2.55]} rotation={[0,-Math.PI/2,0]} width={1.9}/>
    <GymRack position={[-3.48,-.94,-4.55]}/><DumbbellRack position={[2.65,-.94,-4.48]} rotation={[0,.05,0]}/>
    <PlyoBox position={[3.34,-.7,-2.78]} rotation={[0,-.35,0]}/><Kettlebell position={[-2.65,-.83,-2.7]}/><Kettlebell position={[-2.2,-.84,-2.94]} color="#5c765c"/><Kettlebell position={[-1.75,-.84,-2.7]} color="#80694c"/>
    <Plant position={[-4.2,-.9,-3.95]}/>
    <mesh position={[0,2.73,0]} receiveShadow><boxGeometry args={[9.8,.1,9.8]}/><meshStandardMaterial color="#202622" roughness={.92}/></mesh>
    <mesh position={[0,2.64,-.7]}><boxGeometry args={[3.1,.035,.7]}/><meshBasicMaterial color="#f1dfb4" toneMapped={false}/></mesh>
  </group>
}

function ReviewScene({state}:{state:ReviewState}){
  return <Canvas className="squat-technique-review-canvas" shadows frameloop="demand" dpr={[1,1]} camera={{position:cameraPositions[state.view],fov:28}} gl={{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.1,outputColorSpace:THREE.SRGBColorSpace}}>
    <color attach="background" args={['#3f4942']}/>
    <hemisphereLight args={['#f2e5c7','#718072',1.4]}/><ambientLight intensity={.64}/>
    <directionalLight castShadow position={[3.4,5.2,3.1]} intensity={1.36} color="#fff1d3" shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-.00025} shadow-radius={3}/>
    <directionalLight position={[-3.5,2.4,1.5]} intensity={.48} color="#dce9d2"/>
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
