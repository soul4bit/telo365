import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Pause, Play, Rotate3D } from 'lucide-react'
import type { ExerciseCameraPreset } from '../exercise3d'

export type Exercise3DViewerProps={
  modelUrl:string
  animationUrl:string
  animationClip:string
  cameraPreset:ExerciseCameraPreset
  playbackSpeed:number
  posterUrl?:string|null
  available?:boolean
}

const cameraPositions:Record<ExerciseCameraPreset,[number,number,number]>={
  front:[0,1.35,3.35],threeQuarter:[2.45,1.45,2.7],side:[3.35,1.3,0],low:[2.7,.9,3]
}

function useReducedMotion(){
  const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[])
  return reduced
}

class ViewerErrorBoundary extends Component<{children:ReactNode;onError:()=>void},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(_error:Error,_info:ErrorInfo){this.props.onError()}
  render(){return this.state.failed?null:this.props.children}
}

function ViewerFallback({posterUrl,label,retry}:{posterUrl?:string|null;label:string;retry?:()=>void}){
  return <div className="exercise-3d-fallback">{posterUrl?<img src={posterUrl} alt=""/>:<Rotate3D size={28}/>}<div><strong>{label}</strong><p>Добавим демонстрацию техники, когда подготовим модель упражнения.</p>{retry&&<button className="text-button" onClick={retry}>Повторить</button>}</div></div>
}

function CameraControls(){
  const {camera,gl,invalidate}=useThree()
  const controls=useMemo(()=>new OrbitControlsImpl(camera,gl.domElement),[camera,gl.domElement])
  useEffect(()=>{controls.enablePan=false;controls.enableDamping=false;controls.minDistance=2.15;controls.maxDistance=4.75;controls.minPolarAngle=Math.PI*.22;controls.maxPolarAngle=Math.PI*.78;controls.target.set(0,.15,0);controls.update();const update=()=>invalidate();controls.addEventListener('change',update);return()=>{controls.removeEventListener('change',update);controls.dispose()}},[controls,invalidate])
  return null
}

function Humanoid({modelUrl,animationUrl,animationClip,playing,speed,onReady}:{modelUrl:string;animationUrl:string;animationClip:string;playing:boolean;speed:number;onReady:()=>void}){
  const base=useLoader(GLTFLoader,modelUrl)
  const animation=useLoader(GLTFLoader,animationUrl)
  const scene=useMemo(()=>cloneSkeleton(base.scene),[base.scene])
  const mixer=useMemo(()=>new THREE.AnimationMixer(scene),[scene])
  const clip=useMemo(()=>animation.animations.find(item=>item.name===animationClip)||animation.animations[0],[animation.animations,animationClip])
  const action=useMemo(()=>clip?mixer.clipAction(clip):null,[clip,mixer])
  useEffect(()=>{onReady()},[onReady])
  useEffect(()=>{
    if(!action)return
    action.reset().setLoop(THREE.LoopRepeat,Infinity).play()
    return()=>{action.stop();mixer.uncacheAction(clip!)}
  },[action,clip,mixer])
  useEffect(()=>{if(action){action.timeScale=speed;action.paused=!playing}},[action,playing,speed])
  useFrame((_state,delta)=>{if(playing)mixer.update(delta)})
  return <group position={[0,-1.05,0]}><primitive object={scene}/></group>
}

function ThreeScene({modelUrl,animationUrl,animationClip,cameraPreset,playing,speed,onReady}:{modelUrl:string;animationUrl:string;animationClip:string;cameraPreset:ExerciseCameraPreset;playing:boolean;speed:number;onReady:()=>void}){
  return <Canvas className="exercise-3d-canvas" dpr={[1,1.5]} frameloop={playing?'always':'demand'} camera={{position:cameraPositions[cameraPreset],fov:34}} gl={{alpha:true,antialias:true,powerPreference:'low-power'}}>
    <ambientLight intensity={1.25}/><directionalLight position={[3,5,4]} intensity={1.65}/><directionalLight position={[-3,2,1]} intensity={.45}/>
    <Suspense fallback={null}><Humanoid modelUrl={modelUrl} animationUrl={animationUrl} animationClip={animationClip} playing={playing} speed={speed} onReady={onReady}/></Suspense>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.06,0]} receiveShadow><circleGeometry args={[2.1,48]}/><meshBasicMaterial color="#eff5eb" transparent opacity={.82}/></mesh>
    <CameraControls/>
  </Canvas>
}

export default function Exercise3DViewer({modelUrl,animationUrl,animationClip,cameraPreset,playbackSpeed,posterUrl,available=true}:Exercise3DViewerProps){
  const reducedMotion=useReducedMotion(),[playing,setPlaying]=useState(true),[speed,setSpeed]=useState(playbackSpeed),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[retryKey,setRetryKey]=useState(0)
  const markReady=useCallback(()=>setReady(true),[])
  useEffect(()=>setSpeed(playbackSpeed),[playbackSpeed])
  if(reducedMotion)return <ViewerFallback posterUrl={posterUrl} label="Статичная техника"/>
  if(!available)return <ViewerFallback posterUrl={posterUrl} label="3D-техника скоро"/>
  if(failed)return <ViewerFallback posterUrl={posterUrl} label="Не удалось загрузить 3D-модель" retry={()=>{setFailed(false);setReady(false);setRetryKey(value=>value+1)}}/>
  return <section className="exercise-3d-viewer" aria-label="3D-демонстрация техники">
    {!ready&&<div className="exercise-3d-skeleton" aria-hidden="true"/>}
    <ViewerErrorBoundary key={retryKey} onError={()=>setFailed(true)}><ThreeScene modelUrl={modelUrl} animationUrl={animationUrl} animationClip={animationClip} cameraPreset={cameraPreset} playing={playing} speed={speed} onReady={markReady}/></ViewerErrorBoundary>
    <div className="exercise-3d-controls"><button className="icon-button" type="button" aria-label={playing?'Пауза анимации':'Запустить анимацию'} onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button><div role="group" aria-label="Скорость анимации"><button className={speed===.5?'is-active':''} type="button" onClick={()=>setSpeed(.5)}>0.5×</button><button className={speed===1?'is-active':''} type="button" onClick={()=>setSpeed(1)}>1×</button></div><span><Rotate3D size={14}/>Поверни модель</span></div>
  </section>
}
