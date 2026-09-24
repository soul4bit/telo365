import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Pause, Play, Rotate3D, RotateCcw } from 'lucide-react'
import type { ExerciseCameraPreset, ExercisePlaybackMode } from '../exercise3d'

export type Exercise3DViewerProps={
  modelUrl:string
  animationUrl?:string
  animationClip?:string
  cameraPreset:ExerciseCameraPreset
  playbackSpeed:number
  playbackMode?:ExercisePlaybackMode
  posterUrl?:string|null
  available?:boolean
  mode?:'animation'|'preview'
  /** Real trainer assets must contain a real skinned mesh before playback. */
  requireSkinnedMesh?:boolean
  /** Isolated review candidates can opt into a smaller frame without changing product defaults. */
  sceneScale?:number
  /** Optional review-only framing. Omitted by the production viewer. */
  cameraPosition?:[number,number,number]
  controlsTarget?:[number,number,number]
  /** Keeps review-only lighting isolated from the production technique viewer. */
  lightingPreset?:'default'|'mixamo-review'
  /** Developer review can freeze the exact first authored frame for inspection. */
  startPaused?:boolean
}

const cameraPositions:Record<ExerciseCameraPreset,[number,number,number]>={
  front:[0,1.35,3.35],threeQuarter:[2.45,1.45,2.7],side:[3.35,1.3,0],low:[2.7,.9,3]
}
const defaultControlsTarget:[number,number,number]=[0,.15,0]

// The legacy trainer already matches the viewer camera. Smaller Human Base Mesh
// candidates are enlarged only enough to fit a standing body in that same frame.
function viewerScale(scene:THREE.Object3D){
  const height=new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).y
  return height>0&&height<2.1?THREE.MathUtils.clamp(2.1/height,1,1.3):1
}

function assertAnimationCompatibility(scene:THREE.Object3D,clip:THREE.AnimationClip,requireSkinnedMesh:boolean){
  const names=new Set<string>()
  let hasSkinnedMesh=false
  scene.traverse(node=>{if(node.name)names.add(node.name);if((node as THREE.SkinnedMesh).isSkinnedMesh)hasSkinnedMesh=true})
  if(requireSkinnedMesh&&!hasSkinnedMesh)throw new Error('The selected trainer does not contain a SkinnedMesh')
  const missing=[...new Set(clip.tracks.flatMap(track=>{
    try{return [THREE.PropertyBinding.parseTrackName(track.name).nodeName]}catch{return []}
  }).filter((name):name is string=>!!name&&!names.has(name)))]
  if(missing.length)throw new Error(`Animation targets are missing from the trainer rig: ${missing.join(', ')}`)
}

function useReducedMotion(){
  const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[])
  return reduced
}

class ViewerErrorBoundary extends Component<{children:ReactNode;onError:(error:Error)=>void},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error,_info:ErrorInfo){this.props.onError(error)}
  render(){return this.state.failed?null:this.props.children}
}

function ViewerFallback({posterUrl,label,description,retry}:{posterUrl?:string|null;label:string;description?:string;retry?:()=>void}){
  return <div className="exercise-3d-fallback">{posterUrl?<img src={posterUrl} alt=""/>:<Rotate3D size={28}/>}<div><strong>{label}</strong><p>{description||'Добавим демонстрацию техники, когда подготовим модель упражнения.'}</p>{retry&&<button className="text-button" type="button" onClick={retry}>Повторить</button>}</div></div>
}

function CameraControls({resetKey,target=defaultControlsTarget}:{resetKey:number;target?:[number,number,number]}){
  const {camera,gl,invalidate}=useThree()
  const controls=useMemo(()=>new OrbitControlsImpl(camera,gl.domElement),[camera,gl.domElement])
  useEffect(()=>{controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=2.15;controls.maxDistance=4.75;controls.minPolarAngle=Math.PI*.22;controls.maxPolarAngle=Math.PI*.78;controls.target.set(...target);controls.update();controls.saveState();const update=()=>invalidate();controls.addEventListener('change',update);return()=>{controls.removeEventListener('change',update);controls.dispose()}},[controls,invalidate,target])
  useEffect(()=>{controls.reset();controls.update();invalidate()},[controls,invalidate,resetKey])
  return null
}

function Humanoid({modelUrl,animationUrl,animationClip,playing,speed,resetKey,onReady,requireSkinnedMesh=false,sceneScale=1,reviewShadows=false}:{modelUrl:string;animationUrl:string;animationClip:string;playing:boolean;speed:number;resetKey:number;onReady:()=>void;requireSkinnedMesh?:boolean;sceneScale?:number;reviewShadows?:boolean}){
  // useLoader caches by URL: the base trainer and an already opened clip are reused.
  const base=useLoader(GLTFLoader,modelUrl)
  const animationGltf=useLoader(GLTFLoader,animationUrl)
  const scene=useMemo(()=>cloneSkeleton(base.scene),[base.scene])
  const scale=useMemo(()=>viewerScale(scene),[scene])
  const mixer=useMemo(()=>new THREE.AnimationMixer(scene),[scene])
  const clip=useMemo(()=>animationGltf.animations.find(item=>item.name===animationClip)||animationGltf.animations[0],[animationClip,animationGltf.animations])
  if(!clip)throw new Error(`Animation clip "${animationClip}" is missing in ${animationUrl}`)
  const compatibleClip=useMemo(()=>{assertAnimationCompatibility(scene,clip,requireSkinnedMesh);return clip},[clip,requireSkinnedMesh,scene])
  const action=useMemo(()=>mixer.clipAction(compatibleClip),[compatibleClip,mixer])

  useEffect(()=>{onReady()},[onReady])
  useEffect(()=>{
    if(!reviewShadows)return
    scene.traverse(node=>{
      const mesh=node as THREE.Mesh
      if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true}
    })
  },[reviewShadows,scene])
  useEffect(()=>{
    action.reset().setLoop(THREE.LoopRepeat,Infinity).play()
    return()=>{action.stop();mixer.stopAllAction();mixer.uncacheAction(compatibleClip,scene);mixer.uncacheRoot(scene)}
  },[action,compatibleClip,mixer,scene])
  useEffect(()=>{action.timeScale=speed;action.paused=!playing},[action,playing,speed])
  // Reset is an explicit action. Depending on `playing` here made Pause rewind
  // the clip, which prevented review of a fixed authored frame.
  useEffect(()=>{action.reset().play();action.paused=!playing},[action,resetKey])
  useFrame((_state,delta)=>{if(playing)mixer.update(delta)})
  return <group position={[0,-1.05,0]} scale={scale*sceneScale}><primitive object={scene}/></group>
}

function MixamoReviewLighting(){
  return <>
    <hemisphereLight args={['#fbfcf8','#d9e5d5',1.05]}/><ambientLight intensity={.38}/>
    <directionalLight castShadow position={[3.4,5.2,3.1]} intensity={1.05} color="#fffdf7" shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-.00025} shadow-radius={3}/>
    <directionalLight position={[-3.5,2.4,1.5]} intensity={.25} color="#e8f0e4"/>
  </>
}

function StaticTrainer({modelUrl,onReady,sceneScale=1}:{modelUrl:string;onReady:()=>void;sceneScale?:number}){
  const base=useLoader(GLTFLoader,modelUrl)
  const scene=useMemo(()=>cloneSkeleton(base.scene),[base.scene])
  const scale=useMemo(()=>viewerScale(scene),[scene])
  useEffect(()=>{onReady()},[onReady])
  return <group position={[0,-1.05,0]} scale={scale*sceneScale}><primitive object={scene}/></group>
}

function ThreeScene({modelUrl,animationUrl,animationClip,cameraPreset,playing,speed,resetKey,onReady,requireSkinnedMesh=false,mode='animation',sceneScale=1,cameraPosition,controlsTarget,lightingPreset='default'}:{modelUrl:string;animationUrl?:string;animationClip?:string;cameraPreset:ExerciseCameraPreset;playing:boolean;speed:number;resetKey:number;onReady:()=>void;requireSkinnedMesh?:boolean;mode?:'animation'|'preview';sceneScale?:number;cameraPosition?:[number,number,number];controlsTarget?:[number,number,number];lightingPreset?:'default'|'mixamo-review'}){
  if(mode==='animation'&&(!animationUrl||!animationClip))throw new Error('Animation mode requires animationUrl and animationClip')
  const mixamoReview=lightingPreset==='mixamo-review'
  return <Canvas shadows={mixamoReview} className="exercise-3d-canvas" dpr={[1,1.5]} frameloop={playing?'always':'demand'} camera={{position:cameraPosition||cameraPositions[cameraPreset],fov:34}} gl={mixamoReview?{alpha:true,antialias:true,powerPreference:'low-power',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:.82,outputColorSpace:THREE.SRGBColorSpace}:{alpha:true,antialias:true,powerPreference:'low-power'}}>
    {mixamoReview?<MixamoReviewLighting/>:<><ambientLight intensity={1.25}/><directionalLight position={[3,5,4]} intensity={1.65}/><directionalLight position={[-3,2,1]} intensity={.45}/></>}
    <Suspense fallback={null}>{mode==='preview'?<StaticTrainer key={modelUrl} modelUrl={modelUrl} onReady={onReady} sceneScale={sceneScale}/>:<Humanoid key={`${modelUrl}:${animationUrl}:${animationClip}`} modelUrl={modelUrl} animationUrl={animationUrl!} animationClip={animationClip!} playing={playing} speed={speed} resetKey={resetKey} onReady={onReady} requireSkinnedMesh={requireSkinnedMesh} sceneScale={sceneScale} reviewShadows={mixamoReview}/>}</Suspense>
    {mixamoReview?<mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.061,0]} receiveShadow><circleGeometry args={[2.8,64]}/><meshStandardMaterial color="#e4ebe1" roughness={1} metalness={0}/></mesh>:<mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.06,0]} receiveShadow><circleGeometry args={[2.1,48]}/><meshBasicMaterial color="#eff5eb" transparent opacity={.82}/></mesh>}
    <CameraControls resetKey={resetKey} target={controlsTarget}/>
  </Canvas>
}

export default function Exercise3DViewer({modelUrl,animationUrl,animationClip,cameraPreset,playbackSpeed,playbackMode='loop',posterUrl,available=true,requireSkinnedMesh=false,mode='animation',sceneScale=1,cameraPosition,controlsTarget,lightingPreset='default',startPaused=false}:Exercise3DViewerProps){
  const reducedMotion=useReducedMotion(),[playing,setPlaying]=useState(!startPaused),[speed,setSpeed]=useState(playbackSpeed),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[resetKey,setResetKey]=useState(0)
  const assetKey=`${mode}:${modelUrl}:${animationUrl||''}:${animationClip||''}:${requireSkinnedMesh}:${sceneScale}:${cameraPosition?.join(',')||''}:${controlsTarget?.join(',')||''}:${lightingPreset}:${startPaused}`
  const markReady=useCallback(()=>setReady(true),[])
  const reportError=useCallback((error:Error)=>{console.info(`[Exercise3DViewer] 3D asset is not available for ${animationClip||'static preview'} (${modelUrl}, ${animationUrl||'none'}): ${error.message}`);setFailed(true)},[animationClip,animationUrl,modelUrl])
  useEffect(()=>setSpeed(playbackSpeed),[playbackSpeed])
  useEffect(()=>{setReady(false);setFailed(false);setPlaying(!startPaused);setResetKey(value=>value+1)},[assetKey,startPaused])
  if(reducedMotion&&mode==='animation')return <ViewerFallback posterUrl={posterUrl} label="Статичная техника" description="Анимация отключена в настройках уменьшения движения."/>
  if(!available)return <ViewerFallback posterUrl={posterUrl} label="Демонстрация техники готовится" description="Скоро здесь появится интерактивный показ упражнения."/>
  if(failed)return <ViewerFallback posterUrl={posterUrl} label="Демонстрация техники скоро будет доступна" description="Пока можно ориентироваться на ключевые моменты упражнения справа."/>
  return <section className="exercise-3d-viewer" aria-label={mode==='preview'?'3D-предпросмотр модели':'3D-демонстрация техники'} data-playback-mode={playbackMode}>
    {!ready&&<div className="exercise-3d-skeleton" aria-hidden="true"/>}
    <ViewerErrorBoundary key={assetKey} onError={reportError}><ThreeScene modelUrl={modelUrl} animationUrl={animationUrl} animationClip={animationClip} cameraPreset={cameraPreset} playing={mode==='preview'?false:playing} speed={speed} resetKey={resetKey} onReady={markReady} requireSkinnedMesh={requireSkinnedMesh} mode={mode} sceneScale={sceneScale} cameraPosition={cameraPosition} controlsTarget={controlsTarget} lightingPreset={lightingPreset}/></ViewerErrorBoundary>
    <div className="exercise-3d-controls">{mode==='animation'&&<><button className="icon-button" type="button" aria-label={playing?'Пауза анимации':'Запустить анимацию'} onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button><button className="icon-button" type="button" aria-label="Вернуть начало анимации и ракурс" onClick={()=>setResetKey(value=>value+1)}><RotateCcw size={14}/></button><div role="group" aria-label="Скорость анимации"><button className={speed===.5?'is-active':''} type="button" onClick={()=>setSpeed(.5)}>0.5×</button><button className={speed===1?'is-active':''} type="button" onClick={()=>setSpeed(1)}>1×</button></div></>}<span><Rotate3D size={14}/>Поверни модель</span></div>
  </section>
}
