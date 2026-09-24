import { localReviewAssetUrl } from './local-review-assets'

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

/**
 * Public release media is deliberately a rendered end-user video, not a raw
 * Mixamo model or animation file. It keeps the exercise usable while direct
 * browser delivery of combined GLBs remains unapproved.
 */
export type TechniqueVideoAngle='front'|'side'|'back'|'threeQuarter'
export type TechniqueVideoAngleAsset={label:string;videoUrl:string;posterUrl:string}
export type TechniqueVideoAsset={
  label:string
  /** The 3/4 view is the first view; it shows both the hip path and knee alignment. */
  defaultAngle:TechniqueVideoAngle
  angles:Record<TechniqueVideoAngle,TechniqueVideoAngleAsset>
}

// Release media is cached for one day. Bump this only when rendered frames change.
const squatVideoRevision='gym-20260924'

const squatVideoAngles=(avatar:TrainerAvatar):Record<TechniqueVideoAngle,TechniqueVideoAngleAsset>=>{
  const prefix=`/media/exercises/videos/squat-${avatar}`
  const posterPrefix=`/media/exercises/posters/squat-${avatar}`
  const video=(angle:string)=>`${prefix}-${angle}.webm?v=${squatVideoRevision}`
  const poster=(angle:string)=>`${posterPrefix}-${angle}.png?v=${squatVideoRevision}`
  return {
    front:{label:'Спереди',videoUrl:video('front'),posterUrl:poster('front')},
    side:{label:'Сбоку',videoUrl:video('side'),posterUrl:poster('side')},
    back:{label:'Сзади',videoUrl:video('back'),posterUrl:poster('back')},
    threeQuarter:{label:'3/4',videoUrl:video('three-quarter'),posterUrl:poster('three-quarter')}
  }
}

export const squatTechniqueVideos:Record<TrainerAvatar,TechniqueVideoAsset>={
  male:{label:'Мужчина',defaultAngle:'threeQuarter',angles:squatVideoAngles('male')},
  female:{label:'Женщина',defaultAngle:'threeQuarter',angles:squatVideoAngles('female')}
}

export const getSquatTechniqueVideo=(avatar:TrainerAvatar)=>squatTechniqueVideos[avatar]

const placeholderPoster='/media/exercises/poster-placeholder.svg'

/** Test-only original Mixamo With Skin exports. They are deliberately separate
 * from the production exercise registry and must never make `verified` true. */
export type MixamoAirSquatTestAsset=Exercise3DAsset&{label:string;technicalLabel:string;verified:false}
export const mixamoAirSquatTestAssets:Record<TrainerAvatar,MixamoAirSquatTestAsset>={
  male:{label:'Мужчина',technicalLabel:'CH08_NONPBR',modelUrl:localReviewAssetUrl('models/mixamo-male-air-squat-combined-test.glb')||'',animationUrl:localReviewAssetUrl('models/mixamo-male-air-squat-combined-test.glb')||'',animationClip:'squat',cameraPreset:'side',playbackSpeed:1,playbackMode:'loop',posterUrl:placeholderPoster,ready:!!localReviewAssetUrl('models/mixamo-male-air-squat-combined-test.glb'),requireSkinnedMesh:true,rigId:'mixamo-ch08-test',trainerAvatar:'male',verified:false},
  female:{label:'Женщина',technicalLabel:'Jody',modelUrl:localReviewAssetUrl('models/mixamo-female-air-squat-combined-test.glb')||'',animationUrl:localReviewAssetUrl('models/mixamo-female-air-squat-combined-test.glb')||'',animationClip:'squat',cameraPreset:'side',playbackSpeed:1,playbackMode:'loop',posterUrl:placeholderPoster,ready:!!localReviewAssetUrl('models/mixamo-female-air-squat-combined-test.glb'),requireSkinnedMesh:true,rigId:'mixamo-jody-test',trainerAvatar:'female',verified:false}
}
export const getMixamoAirSquatTestAsset=(avatar:TrainerAvatar)=>mixamoAirSquatTestAssets[avatar]

/** Unpublished exercises retain a typed fallback; prototype GLBs are not public. */
const unavailableAnimation=(clip:string,cameraPreset:ExerciseCameraPreset='threeQuarter'):Exercise3DAsset=>({
  modelUrl:'',
  animationUrl:'',
  animationClip:clip,
  cameraPreset,
  playbackSpeed:1,
  playbackMode:'loop',
  posterUrl:placeholderPoster,
  ready:false
})

export const exercise3DAssets:Record<string,Exercise3DAsset>={
  // Mixamo candidates are review-only. Until approval and an allowed delivery
  // method exist, the normal dialog shows its local poster fallback.
  squat:unavailableAnimation('squat','side'),
  'push-up':unavailableAnimation('pushup','side'),
  pushup:unavailableAnimation('pushup','side'),
  plank:unavailableAnimation('plank','side'),
  row:unavailableAnimation('dumbbell_row','threeQuarter'),
  'dumbbell-row':unavailableAnimation('dumbbell_row','threeQuarter'),
  'dumbbell_row':unavailableAnimation('dumbbell_row','threeQuarter'),
  'supported-row':unavailableAnimation('dumbbell_row','threeQuarter'),
  'dumbbell-overhead-press':unavailableAnimation('shoulder_press','threeQuarter'),
  shoulder_press:unavailableAnimation('shoulder_press','threeQuarter'),

  'dumbbell-goblet-squat':unavailableAnimation('goblet_squat','threeQuarter'),
  press:unavailableAnimation('dumbbell_press','threeQuarter'),
  'dumbbell-floor-press':unavailableAnimation('dumbbell_press','threeQuarter'),
  'dumbbell-bench-press':unavailableAnimation('dumbbell_press','threeQuarter'),
  'biceps-curl':unavailableAnimation('biceps_curl','front'),
  'dumbbell-rdl':unavailableAnimation('romanian_deadlift','threeQuarter')
}

export const getExercise3DAsset=(exerciseId:string,_avatar?:TrainerAvatar):Exercise3DAsset|null=>{
  const source=exercise3DAssets[exerciseId]
  return source||null
}
