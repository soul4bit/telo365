/**
 * Checks the projected, deformed trainer geometry throughout the original clip.
 * Read-only: never modifies models, animation, cameras or publication statuses.
 * Start Vite, then: TELO_DEV_PORT=4175 node tools/verify-squat-studio-framing.mjs
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const root=resolve('.')
const output=join(root,'artifacts','studio-quality-review')
const phaseData=JSON.parse(await readFile(join(root,'artifacts','squat-technique-review','phase-times.json'),'utf8'))
const port=process.env.TELO_DEV_PORT||'4175'
const url=`http://127.0.0.1:${port}/tools/squat-technique-review.html`
const views=['front','side','back','three-quarter']
const avatars=['male','female']
const sampleCount=72
const targetSafeMargin=.025
const browserErrors=[]
const failures=[]
const warnings=[]
const report={
  generatedAt:new Date().toISOString(),
  verifier:'tools/verify-squat-studio-framing.mjs',
  method:'Screen-space bounds of actual deformed trainer mesh vertices, not skeletal markers or rest-pose boxes',
  viewport:{width:980,height:980,deviceScaleFactor:1},
  coordinateSystem:'0..1 inside the rendered canvas; origin top left',
  sampleCountPerView:sampleCount,
  includesBothEndpoints:true,
  endpointEvaluation:'Renderer evaluates terminal/start within its existing safe epsilon to avoid a GLTF animation loop boundary artefact',
  targetSafeMargin,
  limitations:[
    'Finite timeline sampling is not a mathematical proof for every time between samples.',
    'Bounds measure the trainer geometry, not anatomical joint centres or exercise correctness.',
    'This does not change specialist review or publication approval.'
  ],
  avatars:{},
  warnings,
  failures,
  browserErrors,
  passed:false
}

const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:report.viewport,deviceScaleFactor:1})
page.on('pageerror',error=>browserErrors.push(error.message))
page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text())})

try{
  for(const avatar of avatars){
    const detail=phaseData.avatars[avatar]
    if(!(Number.isFinite(detail.durationSeconds)&&detail.durationSeconds>0))throw new Error(`Invalid original ${avatar} clip duration`)
    const sourceBytes=await readFile(join(root,detail.source))
    const avatarReport={
      source:detail.source,
      sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),
      clip:detail.clip,
      durationSeconds:detail.durationSeconds,
      views:{}
    }
    report.avatars[avatar]=avatarReport
    await page.goto(`${url}?avatar=${avatar}`,{waitUntil:'networkidle',timeout:30000})
    await page.waitForFunction(()=>Boolean(window.__teloSquatTechniqueReview&&window.__teloSquatFrameBounds),null,{timeout:30000})

    for(const view of views){
      const samples=[]
      const worstMargins={}
      for(let index=0;index<sampleCount;index++){
        const time=detail.durationSeconds*index/(sampleCount-1)
        const next={avatar,view,time,diagnostic:false}
        await page.evaluate(state=>window.__teloSquatTechniqueReview.set(state),next)
        await page.waitForFunction(state=>{
          const current=window.__teloSquatTechniqueReview?.status().state
          return current?.avatar===state.avatar&&current?.view===state.view&&Math.abs(current.time-state.time)<1e-7&&!current.diagnostic
        },next,{timeout:15000})
        await page.evaluate(()=>new Promise(resolveFrame=>requestAnimationFrame(()=>requestAnimationFrame(resolveFrame))))
        await page.waitForFunction(state=>{
          const measurement=window.__teloSquatFrameBounds?.()
          return measurement?.avatar===state.avatar&&Math.abs(measurement.time-state.time)<1e-7&&(!measurement.view||measurement.view===state.view)
        },next,{timeout:15000})
        const measurement=await page.evaluate(()=>window.__teloSquatFrameBounds())
        const {bounds,vertexCount,behindCamera}=measurement
        if(!bounds||!['minX','minY','maxX','maxY'].every(key=>Number.isFinite(bounds[key]))||!Number.isInteger(vertexCount)||vertexCount<=0||bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY){
          throw new Error(`Invalid deformed geometry measurement: ${avatar}/${view} at ${time}s: ${JSON.stringify(measurement)}`)
        }
        if(behindCamera)throw new Error(`${avatar}/${view} at ${time}s: trainer geometry leaves the camera's near/far planes`)
        const margins={left:bounds.minX,right:1-bounds.maxX,top:bounds.minY,bottom:1-bounds.maxY}
        samples.push({timeSeconds:time,vertexCount,bounds,margins})
        for(const [edge,margin] of Object.entries(margins)){
          if(!worstMargins[edge]||margin<worstMargins[edge].fraction)worstMargins[edge]={fraction:margin,timeSeconds:time}
        }
      }
      const minimumMargin=Math.min(...Object.values(worstMargins).map(value=>value.fraction))
      avatarReport.views[view]={sampleCount:samples.length,minimumMargin,worstMargins,samples}
      if(minimumMargin<0)failures.push(`${avatar}/${view}: trainer geometry leaves the frame (worst margin ${(minimumMargin*100).toFixed(3)}%)`)
      else if(minimumMargin<targetSafeMargin)warnings.push(`${avatar}/${view}: minimum margin ${(minimumMargin*100).toFixed(3)}% is below the ${(targetSafeMargin*100).toFixed(1)}% target`)
      console.log(`${avatar}/${view}: ${samples.length} samples, minimum margin ${(minimumMargin*100).toFixed(2)}%`)
    }
  }
  if(browserErrors.length)failures.push(`${browserErrors.length} browser error(s); see report`)
}catch(error){
  failures.push(error instanceof Error?error.message:String(error))
}finally{
  await browser.close()
  report.passed=failures.length===0&&avatars.every(avatar=>views.every(view=>report.avatars[avatar]?.views[view]?.sampleCount===sampleCount))
  await mkdir(output,{recursive:true})
  await writeFile(join(output,'framing-report.json'),JSON.stringify(report,null,2)+'\n')
}

for(const warning of warnings)console.warn(warning)
for(const failure of failures)console.error(failure)
console.log(`Framing ${report.passed?'PASS':'FAIL'}: artifacts/studio-quality-review/framing-report.json`)
if(!report.passed)process.exitCode=1
