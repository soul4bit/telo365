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
export type TechniqueVideoBranding='embedded'|'legacy-overlay'
export type TechniqueVideoAngleAsset={label:string;videoUrl:string;posterUrl:string}
export type TechniqueVideoStudio={
  /** A stable room identity makes future exercise renders feel like one TELO365 studio. */
  id:string
  /** Embedded branding is part of the rendered room; legacy-overlay preserves existing media. */
  branding:TechniqueVideoBranding
  framing:'full-body-safe'
}
export type TechniqueVideoAsset={
  label:string
  /** The 3/4 view is the first view; it shows both the hip path and knee alignment. */
  defaultAngle:TechniqueVideoAngle
  /** Angle assets are intentionally partial: new exercises can ship incrementally. */
  angles:Partial<Record<TechniqueVideoAngle,TechniqueVideoAngleAsset>>
  studio:TechniqueVideoStudio
}

export type ExerciseTechnique={
  cues:readonly string[]
  mistakes?:readonly string[]
  safetyNote?:string
}

const techniqueVideoAngleOrder:TechniqueVideoAngle[]=['front','side','back','threeQuarter']

export const getTechniqueVideoAngles=(asset:TechniqueVideoAsset)=>techniqueVideoAngleOrder.flatMap(angle=>{
  const media=asset.angles[angle]
  return media?[{angle,...media}]:[]
})

export const getTechniqueVideoAngle=(asset:TechniqueVideoAsset,requested:TechniqueVideoAngle=asset.defaultAngle)=>{
  const selected=asset.angles[requested]||asset.angles[asset.defaultAngle]
  if(selected)return {angle:asset.angles[requested]?requested:asset.defaultAngle,...selected}
  return getTechniqueVideoAngles(asset)[0]||null
}

const defaultExerciseTechnique:ExerciseTechnique={
  cues:[
    '\u0414\u0432\u0438\u0433\u0430\u0439\u0441\u044f \u043f\u043b\u0430\u0432\u043d\u043e \u0438 \u043f\u043e\u0434 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0435\u043c.',
    '\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0439 \u043a\u043e\u043c\u0444\u043e\u0440\u0442\u043d\u043e\u0435 \u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u043a\u043e\u0440\u043f\u0443\u0441\u0430.',
    '\u041e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0441\u044c, \u0435\u0441\u043b\u0438 \u043f\u043e\u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0431\u043e\u043b\u044c \u0438\u043b\u0438 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u043d\u044b\u0439 \u0434\u0438\u0441\u043a\u043e\u043c\u0444\u043e\u0440\u0442.'
  ],
  safetyNote:'\u0412\u044b\u0431\u0438\u0440\u0430\u0439 \u043a\u043e\u043c\u0444\u043e\u0440\u0442\u043d\u0443\u044e \u0430\u043c\u043f\u043b\u0438\u0442\u0443\u0434\u0443. \u041f\u0440\u0438 \u0431\u043e\u043b\u0438 \u0438\u043b\u0438 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u043d\u043e\u043c \u0434\u0438\u0441\u043a\u043e\u043c\u0444\u043e\u0440\u0442\u0435 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0441\u044c.'
}

/** Content lives with the exercise registry, rather than inside the dialog UI. */
export const exerciseTechnique:Record<string,ExerciseTechnique>={
  squat:{
    cues:[
      '\u0421\u0442\u043e\u043f\u044b \u043f\u0440\u0438\u043c\u0435\u0440\u043d\u043e \u043d\u0430 \u0448\u0438\u0440\u0438\u043d\u0435 \u043f\u043b\u0435\u0447.',
      '\u041a\u043e\u043b\u0435\u043d\u0438 \u0434\u0432\u0438\u0436\u0443\u0442\u0441\u044f \u043f\u043e \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044e \u043d\u043e\u0441\u043a\u043e\u0432.',
      '\u0421\u043f\u0438\u043d\u0430 \u043e\u0441\u0442\u0430\u0451\u0442\u0441\u044f \u043d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u043e\u0439.',
      '\u041e\u043f\u0443\u0441\u043a\u0430\u0439\u0441\u044f \u043f\u043b\u0430\u0432\u043d\u043e \u0438 \u043f\u043e\u0434 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0435\u043c, \u0431\u0435\u0437 \u0440\u044b\u0432\u043a\u0430.'
    ],
    mistakes:[
      '\u041a\u043e\u043b\u0435\u043d\u0438 \u0437\u0430\u0432\u0430\u043b\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u0432\u043d\u0443\u0442\u0440\u044c.',
      '\u041f\u044f\u0442\u043a\u0438 \u043e\u0442\u0440\u044b\u0432\u0430\u044e\u0442\u0441\u044f \u043e\u0442 \u043f\u043e\u043b\u0430.',
      '\u0421\u043f\u0438\u043d\u0430 \u0447\u0440\u0435\u0437\u043c\u0435\u0440\u043d\u043e \u043e\u043a\u0440\u0443\u0433\u043b\u044f\u0435\u0442\u0441\u044f.',
      '\u0414\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442\u0441\u044f \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0440\u0435\u0437\u043a\u043e.'
    ],
    safetyNote:'\u0420\u0430\u0431\u043e\u0442\u0430\u0439 \u0432 \u043a\u043e\u043c\u0444\u043e\u0440\u0442\u043d\u043e\u0439 \u0430\u043c\u043f\u043b\u0438\u0442\u0443\u0434\u0435. \u041f\u0440\u0438 \u0431\u043e\u043b\u0438 \u0438\u043b\u0438 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u043d\u043e\u043c \u0434\u0438\u0441\u043a\u043e\u043c\u0444\u043e\u0440\u0442\u0435 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0441\u044c.'
  }
}
export const getExerciseTechnique=(exerciseId:string)=>exerciseTechnique[exerciseId]||defaultExerciseTechnique

export const telo365FunctionalStudio:TechniqueVideoStudio={
  id:'telo365-functional-studio-v3',
  branding:'embedded',
  framing:'full-body-safe'
}

// Release media is cached for one day. Bump this only when rendered frames change.
const squatVideoRevision='studio-v3-20260924'

const squatVideoAngles=(avatar:TrainerAvatar):Record<TechniqueVideoAngle,TechniqueVideoAngleAsset>=>{
  const prefix=`/media/exercises/videos/squat-${avatar}`
  const posterPrefix=`/media/exercises/posters/squat-${avatar}`
  const video=(angle:string)=>`${prefix}-${angle}.webm?v=${squatVideoRevision}`
  const poster=(angle:string)=>`${posterPrefix}-${angle}.png?v=${squatVideoRevision}`
  return {
    front:{label:'\u0421\u043f\u0435\u0440\u0435\u0434\u0438',videoUrl:video('front'),posterUrl:poster('front')},
    side:{label:'\u0421\u0431\u043e\u043a\u0443',videoUrl:video('side'),posterUrl:poster('side')},
    back:{label:'\u0421\u0437\u0430\u0434\u0438',videoUrl:video('back'),posterUrl:poster('back')},
    threeQuarter:{label:'3/4',videoUrl:video('three-quarter'),posterUrl:poster('three-quarter')}
  }
}

const squatStudio:TechniqueVideoStudio={
  ...telo365FunctionalStudio
}

export const squatTechniqueVideos:Record<TrainerAvatar,TechniqueVideoAsset>={
  male:{label:'\u041c\u0443\u0436\u0447\u0438\u043d\u0430',defaultAngle:'threeQuarter',angles:squatVideoAngles('male'),studio:squatStudio},
  female:{label:'\u0416\u0435\u043d\u0449\u0438\u043d\u0430',defaultAngle:'threeQuarter',angles:squatVideoAngles('female'),studio:squatStudio}
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
