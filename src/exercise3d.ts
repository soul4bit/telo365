export type ExerciseCameraPreset = 'front'|'threeQuarter'|'side'|'low'
export type ExercisePlaybackMode = 'loop'

export type Exercise3DAsset = {
  modelUrl:string
  animationUrl:string
  animationClip:string
  cameraPreset:ExerciseCameraPreset
  playbackSpeed:number
  playbackMode:ExercisePlaybackMode
  posterUrl:string
  ready:boolean
}

const trainerModel='/media/exercises/models/telo-trainer.glb'
const placeholderPoster='/media/exercises/poster-placeholder.svg'
const animation=(clip:string,cameraPreset:ExerciseCameraPreset='threeQuarter',ready=false):Exercise3DAsset=>({
  modelUrl:trainerModel,
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

export const getExercise3DAsset=(exerciseId:string)=>exercise3DAssets[exerciseId]||null
