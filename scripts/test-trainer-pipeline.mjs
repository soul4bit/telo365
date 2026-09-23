import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve, relative } from 'node:path'
import { repoRoot } from './trainer-utils.mjs'

const root=await mkdtemp(resolve(repoRoot,'artifacts','trainer-new-'))
const output=relative(repoRoot,root).replaceAll('\\','/')
try{
  const run=exercise=>spawnSync(process.execPath,['scripts/trainer-new.mjs','--exercise',exercise,'--output',output],{cwd:repoRoot,encoding:'utf8'})
  const first=run('lunge')
  if(first.status!==0)throw new Error(`trainer:new failed: ${first.stderr||first.stdout}`)
  const manifest=JSON.parse(await readFile(resolve(root,'exercises','lunge.json'),'utf8'))
  if(manifest.exerciseId!=='lunge'||manifest.avatars.male.technicalStatus!=='not_started'||manifest.avatars.female.technicalStatus!=='not_started')throw new Error('trainer:new created an invalid exercise manifest')
  if(manifest.avatars.male.animationGlb.endsWith('squat-test.glb')||manifest.avatars.female.animationGlb.endsWith('squat-test.glb'))throw new Error('trainer:new must not copy a squat animation')
  const maleTemplate=await readFile(resolve(root,'blender','lunge','prepare-male-lunge.py'),'utf8')
  if(!maleTemplate.includes('No authored motion has been created')||maleTemplate.includes('squat-test.glb'))throw new Error('trainer:new must create a guarded authored-motion template')
  const second=run('lunge')
  if(second.status===0)throw new Error('trainer:new overwrote an existing exercise')
  console.log(JSON.stringify({scaffold:'passed',temporaryOutput:output,noAnimationGlbCreated:true,overwriteProtected:true},null,2))
}finally{
  await rm(root,{recursive:true,force:true})
}
