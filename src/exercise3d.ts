export type ExerciseCameraPreset = 'front'|'threeQuarter'|'side'|'low'

export type Exercise3DAsset = {
  modelUrl:string
  animationUrl:string
  animationClip:string
  cameraPreset:ExerciseCameraPreset
  playbackSpeed:number
  posterUrl:string
  ready:boolean
}

const baseModel='/media/exercises/models/humanoid-base.glb'
const placeholderPoster='/media/exercises/poster-placeholder.svg'
const animation=(clip:string,cameraPreset:ExerciseCameraPreset='threeQuarter'):Exercise3DAsset=>({
  modelUrl:baseModel,
  animationUrl:`/media/exercises/animations/${clip}.glb`,
  animationClip:clip,
  cameraPreset,
  playbackSpeed:1,
  posterUrl:placeholderPoster,
  // Flip this after the local GLB files are supplied. Until then no 3D request
  // is made and the local poster is shown immediately.
  ready:false
})

export const exercise3DAssets:Record<string,Exercise3DAsset>={
  squat:animation('squat','front'),
  'dumbbell-goblet-squat':animation('goblet_squat','front'),
  'push-up':animation('pushup','side'),
  plank:animation('plank','side'),
  press:animation('dumbbell_press','threeQuarter'),
  'dumbbell-floor-press':animation('dumbbell_press','threeQuarter'),
  'dumbbell-bench-press':animation('dumbbell_press','threeQuarter'),
  row:animation('dumbbell_row','threeQuarter'),
  'dumbbell-row':animation('dumbbell_row','threeQuarter'),
  'supported-row':animation('dumbbell_row','threeQuarter'),
  'biceps-curl':animation('biceps_curl','front'),
  'dumbbell-overhead-press':animation('shoulder_press','front'),
  'dumbbell-rdl':animation('romanian_deadlift','threeQuarter')
}

export const getExercise3DAsset=(exerciseId:string)=>exercise3DAssets[exerciseId]||null
