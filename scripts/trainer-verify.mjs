import { parseArgs, readCharactersManifest, readJson, trainerRoot, exerciseManifestPath, verifyAvatarAnimation } from './trainer-utils.mjs'

const args=parseArgs()
if(!args.exercise)throw new Error('Использование: npm run trainer:verify -- --exercise squat')
try{
  const manifest=await readJson(exerciseManifestPath(trainerRoot,args.exercise))
  const characters=await readCharactersManifest()
  const results=[]
  for(const avatar of ['male','female'])results.push(await verifyAvatarAnimation({characters,manifest,avatar}))
  console.log(JSON.stringify({exerciseId:manifest.exerciseId,technicalCompatibility:'passed',manifestTechnicalStatus:manifest.reviews.technical,publication:{automatic:false,ready:manifest.reviews.readyForPublication},avatars:results},null,2))
}catch(error){
  console.error(JSON.stringify({exerciseId:args.exercise,technicalCompatibility:'not-ready',publication:{automatic:false},reason:error instanceof Error?error.message:String(error),nextStep:'Подготовьте отдельные авторские male/female GLB-анимации, затем повторите техническую проверку.'},null,2))
  process.exitCode=1
}
