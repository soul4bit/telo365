export type ExerciseCameraPreset = 'front'|'threeQuarter'|'side'|'low'
export type ExercisePlaybackMode = 'loop'
export type TrainerAvatar = 'male'|'female'

export type Exercise3DAsset = {
  modelUrl:string
  animationUrl:string
  animationClip:string
  cameraPreset:ExerciseCameraPreset
  playbackSpeed:number
  playbackMode:ExercisePlaybackMode
  posterUrl:string
  ready:boolean
  /** The legacy trainer is a transform hierarchy; production trainers must be skinned GLBs. */
  requireSkinnedMesh?:boolean
  rigId?:string
  trainerAvatar?:TrainerAvatar
}

export type TrainerAvatarOption = {
  id:TrainerAvatar
  label:string
  modelUrl:string
  animationBasePath:string
  rigId:string
  /**
   * Keep false until the supplied GLB has been inspected in a DCC tool and in
   * the viewer: SkinnedMesh, bind/rest pose, bone axes and animation tracks.
   */
  verified:boolean
  /** Only add clips that were exported or retargeted specifically for this rig. */
  verifiedClips:readonly string[]
}

const legacyTrainerModel='/media/exercises/models/telo-trainer.glb'
const placeholderPoster='/media/exercises/poster-placeholder.svg'

// Paths are reserved for genuine, separately authored GLB models. They are
// deliberately not aliases of the procedural legacy trainer.
export const trainerAvatarOptions:Record<TrainerAvatar,TrainerAvatarOption>={
  male:{id:'male',label:'Мужчина',modelUrl:'/media/exercises/models/telo-trainer-male.glb',animationBasePath:'/media/exercises/animations/male',rigId:'telo-humanoid-v1',verified:false,verifiedClips:[]},
  female:{id:'female',label:'Женщина',modelUrl:'/media/exercises/models/telo-trainer-female.glb',animationBasePath:'/media/exercises/animations/female',rigId:'telo-humanoid-v1',verified:false,verifiedClips:[]}
}

// A selector is useful only when both real models and the current exercise's
// specifically validated clips are present. This prevents unverified retargeting.
export const getAvailableTrainerAvatars=(animationClip?:string)=>animationClip?Object.values(trainerAvatarOptions).filter(option=>option.verified&&option.verifiedClips.includes(animationClip)):[]
export const isTrainerAvatarSelectionEnabled=(animationClip?:string)=>getAvailableTrainerAvatars(animationClip).length===2

const animation=(clip:string,cameraPreset:ExerciseCameraPreset='threeQuarter',ready=false):Exercise3DAsset=>({
  modelUrl:legacyTrainerModel,
  animationUrl:`/media/exercises/animations/${clip}.glb`,
  animationClip:clip,
  cameraPreset,
  playbackSpeed:1,
  playbackMode:'loop',
  posterUrl:placeholderPoster,
  ready
})

// These five entries request local GLB files only when the user opens the
// lazy-loaded technique dialog. Missing assets fall back to this local poster.
const readyAnimation=(clip:string,cameraPreset:ExerciseCameraPreset)=>animation(clip,cameraPreset,true)

export const exercise3DAssets:Record<string,Exercise3DAsset>={
  squat:readyAnimation('squat','threeQuarter'),
  'push-up':readyAnimation('pushup','side'),
  pushup:readyAnimation('pushup','side'),
  plank:readyAnimation('plank','side'),
  row:readyAnimation('dumbbell_row','threeQuarter'),
  'dumbbell-row':readyAnimation('dumbbell_row','threeQuarter'),
  'dumbbell_row':readyAnimation('dumbbell_row','threeQuarter'),
  'supported-row':readyAnimation('dumbbell_row','threeQuarter'),
  'dumbbell-overhead-press':readyAnimation('shoulder_press','threeQuarter'),
  shoulder_press:readyAnimation('shoulder_press','threeQuarter'),

  'dumbbell-goblet-squat':animation('goblet_squat','threeQuarter'),
  press:animation('dumbbell_press','threeQuarter'),
  'dumbbell-floor-press':animation('dumbbell_press','threeQuarter'),
  'dumbbell-bench-press':animation('dumbbell_press','threeQuarter'),
  'biceps-curl':animation('biceps_curl','front'),
  'dumbbell-rdl':animation('romanian_deadlift','threeQuarter')
}

export const getExercise3DAsset=(exerciseId:string,avatar?:TrainerAvatar):Exercise3DAsset|null=>{
  const source=exercise3DAssets[exerciseId]
  if(!source)return null
  const trainer=getAvailableTrainerAvatars(source.animationClip).find(option=>option.id===avatar)
  if(!trainer)return source
  return {...source,modelUrl:trainer.modelUrl,animationUrl:`${trainer.animationBasePath}/${source.animationClip}.glb`,requireSkinnedMesh:true,rigId:trainer.rigId,trainerAvatar:trainer.id}
}
