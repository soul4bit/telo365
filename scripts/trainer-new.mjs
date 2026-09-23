import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  assertCanonicalModel,
  assertExerciseId,
  collectExercise3dIds,
  parseArgs,
  readCharactersManifest,
  repoRoot,
  toRepoPath,
  withinRepo,
  writeJson
} from './trainer-utils.mjs'

const args=parseArgs()
if(!args.exercise)throw new Error('РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ: npm run trainer:new -- --exercise lunge [--output trainer]')
const exerciseId=assertExerciseId(args.exercise)
const root=withinRepo(typeof args.output==='string'?args.output:'trainer')
const manifestPath=resolve(root,'exercises',`${exerciseId}.json`)

try{
  await readFile(manifestPath)
  throw new Error(`РЈРїСЂР°Р¶РЅРµРЅРёРµ ${exerciseId} СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚: ${toRepoPath(manifestPath)}. РљРѕРјР°РЅРґР° РЅРёС‡РµРіРѕ РЅРµ РїРµСЂРµР·Р°РїРёСЃР°Р»Р°.`)
}catch(error){
  if(error?.code!=='ENOENT')throw error
}

const characters=await readCharactersManifest()
await Promise.all(['male','female'].map(avatar=>assertCanonicalModel(characters,avatar)))
const registered=(await collectExercise3dIds()).has(exerciseId)
const publicAnimation=avatar=>`public/media/exercises/animations/${avatar}/${exerciseId}.glb`
const manifest={
  schemaVersion:1,
  exerciseId,
  name:exerciseId,
  registry:{
    exercise3dState:registered?'registered':'not_registered',
    previewOnly:true,
    note:'РЁР°Р±Р»РѕРЅ СЃРѕР·РґР°РЅ Р±РµР· animation GLB. РћРЅ РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ РґР»СЏ РёР·РѕР»РёСЂРѕРІР°РЅРЅРѕР№ РїСЂРѕРІРµСЂРєРё РїРѕСЃР»Рµ СЂСѓС‡РЅРѕР№ РїРѕРґРіРѕС‚РѕРІРєРё РґРІРёР¶РµРЅРёСЏ.'
  },
  cameraPreset:'threeQuarter',
  equipment:{required:false,items:[],attachments:[]},
  animation:{
    clip:exerciseId,
    loop:false,
    requiresHipsTranslation:false,
    durationSeconds:null,
    durationToleranceSeconds:0.1,
    authoredMotionRequired:true
  },
  avatars:Object.fromEntries(['male','female'].map(avatar=>[avatar,{animationGlb:publicAnimation(avatar),technicalStatus:'not_started'}])),
  reviews:{technical:'not_started',visual:'pending',specialistTechnique:'pending',readyForPublication:false},
  publication:{state:'draft',approvedByUser:false}
}

const blenderTemplate=avatar=>`# Blender 5.2+ template for TELO365 ${exerciseId} (${avatar})\n# This template intentionally DOES NOT create an animation or GLB.\n# Create and review real key poses before calling export_animation_glb.\nimport bpy\nfrom pathlib import Path\nimport sys\ndef find_repo_root():\n    for parent in Path(__file__).resolve().parents:\n        if (parent / 'tools' / 'trainer' / 'exercise_animation_pipeline.py').is_file():\n            return parent\n    raise RuntimeError('TELO365 repository root was not found.')\nsys.path.append(str(find_repo_root() / 'tools' / 'trainer'))\nfrom exercise_animation_pipeline import assert_canonical_rig, assert_authored_action, assert_loop, export_animation_glb\n\nEXERCISE_ID = '${exerciseId}'\nAVATAR = '${avatar}'\n# Open the canonical working .blend for the selected avatar. Never modify its armature topology.\n# After authoring/retargeting motion, set RIG_NAME and ACTION_NAME and uncomment the export block.\nRIG_NAME = 'TeloTrainerRig'\nACTION_NAME = EXERCISE_ID\nOUTPUT = find_repo_root() / '${publicAnimation(avatar)}'\n\nraise RuntimeError(\n    'No authored motion has been created. Create real ${exerciseId} key poses, manually review technique, then use the pipeline helper to export.'\n)\n\n# rig = bpy.data.objects[RIG_NAME]\n# assert_canonical_rig(rig)\n# action = bpy.data.actions[ACTION_NAME]\n# assert_authored_action(action, EXERCISE_ID)\n# assert_loop(action)  # only for cyclic movements\n# export_animation_glb(rig, action, OUTPUT, EXERCISE_ID)\n`
const readme=`# ${exerciseId}: СЂР°Р±РѕС‡Р°СЏ Р·Р°РіРѕС‚РѕРІРєР°\n\nР­С‚Р° РїР°РїРєР° СЃРѕР·РґР°РЅР° РєРѕРјР°РЅРґРѕР№ \`trainer:new\`. РћРЅР° **РЅРµ СЃРѕРґРµСЂР¶РёС‚** С„РёРєС‚РёРІРЅРѕР№ GLB-Р°РЅРёРјР°С†РёРё Рё РЅРµ РјРµРЅСЏРµС‚ production viewer.\n\n1. РћС‚РєСЂРѕР№ РєР°РЅРѕРЅРёС‡РµСЃРєРёР№ СЂР°Р±РѕС‡РёР№ Blender-С„Р°Р№Р» РёР· \`trainer/characters.manifest.json\`.\n2. РЎРѕР·РґР°Р№ РёР»Рё СЂРµС‚Р°СЂРіРµС‚РёСЂСѓР№ РѕС‚РґРµР»СЊРЅСѓСЋ Р°РЅРёРјР°С†РёСЋ РґР»СЏ РјСѓР¶С‡РёРЅС‹ Рё Р¶РµРЅС‰РёРЅС‹. РќРµ РјРµРЅСЏР№ РєР°РЅРѕРЅРёС‡РµСЃРєРёР№ СЂРёРі.\n3. РџСЂРѕРІРµСЂСЊ РїРѕР·С‹, С‚РµС…РЅРёРєСѓ Рё РґРµС„РѕСЂРјР°С†РёРё РІСЂСѓС‡РЅСѓСЋ.\n4. Р­РєСЃРїРѕСЂС‚РёСЂСѓР№ РєР»РёРїС‹ РІ РїСѓС‚Рё, Р·Р°РїРёСЃР°РЅРЅС‹Рµ РІ \`exercises/${exerciseId}.json\`.\n5. РћР±РЅРѕРІРё duration, cameraPreset, equipment Рё СЃС‚Р°С‚СѓСЃС‹ С‚РѕР»СЊРєРѕ РїРѕ РёС‚РѕРіР°Рј РїСЂРѕРІРµСЂРєРё.\n6. Р’С‹РїРѕР»РЅРё \`npm run trainer:verify -- --exercise ${exerciseId}\`.\n\nРЁР°Р±Р»РѕРЅС‹ Blender РЅР°РјРµСЂРµРЅРЅРѕ РѕСЃС‚Р°РЅР°РІР»РёРІР°СЋС‚СЃСЏ РґРѕ СЃРѕР·РґР°РЅРёСЏ РЅР°СЃС‚РѕСЏС‰РµРіРѕ РґРІРёР¶РµРЅРёСЏ.\n`

await writeJson(manifestPath,manifest)
const blenderRoot=resolve(root,'blender',exerciseId)
await mkdir(blenderRoot,{recursive:true})
await Promise.all(['male','female'].map(avatar=>writeFile(resolve(blenderRoot,`prepare-${avatar}-${exerciseId}.py`),blenderTemplate(avatar),'utf8')))
await writeFile(resolve(root,'exercises',`${exerciseId}.README.md`),readme,'utf8')
console.log(JSON.stringify({created:{manifest:toRepoPath(manifestPath),blenderTemplates:['male','female'].map(avatar=>toRepoPath(resolve(blenderRoot,`prepare-${avatar}-${exerciseId}.py`))),instructions:toRepoPath(resolve(root,'exercises',`${exerciseId}.README.md`))},exerciseId,registeredInExercise3d:registered,animationGlbCreated:false},null,2))
