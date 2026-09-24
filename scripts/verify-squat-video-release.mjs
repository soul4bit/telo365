import { createHash } from 'node:crypto'
import { access, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root=process.cwd()
const mediaRoot=resolve(root,'public','media','exercises')
const reviewManifestPath=resolve(root,'artifacts','squat-release-review','video-release-manifest.json')
const releaseManifestPath=resolve(root,'trainer','squat-video-release.manifest.json')
const trainingPlanPath=resolve(root,'server','training-plan.mjs')
const techniqueDialogPath=resolve(root,'src','components','Workouts.tsx')
const techniqueViewerPath=resolve(root,'src','components','TechniqueVideoViewer.tsx')
const exerciseRegistryPath=resolve(root,'src','exercise3d.ts')
const expectedAngles={front:'front',side:'side',back:'back',threeQuarter:'three-quarter'}
const expected=Object.fromEntries(['male','female'].map(avatar=>[avatar,Object.fromEntries(Object.entries(expectedAngles).map(([angle,fileAngle])=>[angle,{video:`videos/squat-${avatar}-${fileAngle}.webm`,poster:`posters/squat-${avatar}-${fileAngle}.png`}]))]))

const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex')
const exists=async file=>{await access(file);return file}

const [manifest,releaseManifest,trainingPlanSource,techniqueDialogSource,techniqueViewerSource,exerciseRegistrySource]=await Promise.all([
  readFile(reviewManifestPath,'utf8').then(JSON.parse),
  readFile(releaseManifestPath,'utf8').then(JSON.parse),
  readFile(trainingPlanPath,'utf8'),
  readFile(techniqueDialogPath,'utf8'),
  readFile(techniqueViewerPath,'utf8'),
  readFile(exerciseRegistryPath,'utf8')
])
if(!/rendered frames.*not raw Mixamo GLB/i.test(manifest.purpose||''))throw new Error('Release manifest does not declare rendered-video-only delivery')
if(releaseManifest.exerciseId!=='squat')throw new Error('Air Squat video release must target only the canonical squat exercise ID')
if(!/exercise\(\{id:'squat',name:'Приседания'/.test(trainingPlanSource)||/exercise\(\{id:'squat',name:'Приседания с опорой'/.test(trainingPlanSource))throw new Error('Canonical squat metadata must describe bodyweight squats without support')
if(!/const squatVideo=item\.exerciseId==='squat'\?getSquatTechniqueVideo\(trainerAvatar\):null/.test(techniqueDialogSource))throw new Error('Technique dialog must bind Air Squat videos only to exerciseId squat')
if(!/techniqueExerciseName=.*exerciseId==='squat'\?'Приседания'/.test(techniqueDialogSource))throw new Error('Technique dialog must preserve the canonical Air Squat title for legacy sessions')

if(releaseManifest.specialistTechniqueReview!=='pending'||releaseManifest.verified!==false)throw new Error('Video release must keep specialist review pending and remain unverified')
if(releaseManifest.mediaArchitecture?.mode!=='gender-by-angle'||releaseManifest.mediaArchitecture?.allowPartialAngles!==true)throw new Error('Release manifest must declare optional gender-by-angle media architecture')
if(releaseManifest.studio?.currentId!=='telo365-functional-studio-v3'||releaseManifest.studio?.targetId!=='telo365-functional-studio-v3')throw new Error('Release manifest must declare the functional studio for rendered media')
if(!/angles:Partial<Record<TechniqueVideoAngle,TechniqueVideoAngleAsset>>/.test(exerciseRegistrySource)||!/getTechniqueVideoAngles/.test(techniqueViewerSource))throw new Error('Technique viewer must render only available angle assets')
if(!/exerciseTechnique:Record<string,ExerciseTechnique>/.test(exerciseRegistrySource)||!/commonMistakes/.test(techniqueDialogSource))throw new Error('Technique cues and mistakes must be stored in exercise metadata, not hardcoded in dialog layout')

const verified={}
for(const [avatar,angleMap] of Object.entries(expected)){
  const release=manifest.avatars?.[avatar]
  if(!release?.angles||release.defaultAngle!=='threeQuarter')throw new Error(`${avatar}: release manifest must declare all angles with threeQuarter as default`)
  verified[avatar]={defaultAngle:'threeQuarter',angles:{}}
  for(const [angle,paths] of Object.entries(angleMap)){
    const video=await exists(resolve(mediaRoot,paths.video))
    const poster=await exists(resolve(mediaRoot,paths.poster))
    const reviewVideo=await exists(resolve(root,'artifacts','squat-release-review',`squat-${avatar}-${expectedAngles[angle]}.webm`))
    const [videoBuffer,videoStats,posterStats]=await Promise.all([readFile(video),stat(video),stat(poster)])
    if(videoStats.size<100_000)throw new Error(`${avatar}/${angle}: video is implausibly small (${videoStats.size} bytes)`)
    if(posterStats.size<10_000)throw new Error(`${avatar}/${angle}: poster is implausibly small (${posterStats.size} bytes)`)
    if(!videoBuffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))throw new Error(`${avatar}/${angle}: ${paths.video} is not an EBML/WebM file`)
    if(paths.video.includes('.glb')||paths.poster.includes('.glb'))throw new Error(`${avatar}/${angle}: release media must not point to a GLB`)
    const generated=manifest.avatars?.[avatar]?.angles?.[angle]
    if(!generated)throw new Error(`${avatar}/${angle}: missing from generated release manifest`)
    const videoSha256=await hash(video),posterSha256=await hash(poster)
    if(generated.videoSha256!==videoSha256||generated.posterSha256!==posterSha256)throw new Error(`${avatar}/${angle}: generated release manifest hashes do not match media`)
    if(await hash(reviewVideo)!==videoSha256)throw new Error(`${avatar}/${angle}: review WebM does not match release media`)
    verified[avatar].angles[angle]={video:paths.video,poster:paths.poster,videoBytes:videoStats.size,posterBytes:posterStats.size,videoSha256,posterSha256}
  }
}

console.log(JSON.stringify({status:'passed',delivery:'rendered-video-only',avatars:verified},null,2))
