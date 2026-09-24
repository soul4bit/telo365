/*
 * Deterministic browser capture for independent visual review of the original
 * Mixamo Air Squat combined GLBs. It does not write or transform GLB files.
 *
 * Start a local Vite server first, then run:
 *   TELO_DEV_PORT=4175 node tools/render-squat-technique-review-browser.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const root=resolve('.')
const output=join(root,'artifacts','squat-technique-review')
const phaseData=JSON.parse(await readFile(join(output,'phase-times.json'),'utf8'))
const port=process.env.TELO_DEV_PORT||'4174'
const url=`http://127.0.0.1:${port}/tools/squat-technique-review.html`
const fps=30
const views=['front','side','back','three-quarter']
const controlViews=['front','side']
const requestedAvatar=process.env.TELO_REVIEW_AVATAR
if(requestedAvatar&&requestedAvatar!=='male'&&requestedAvatar!=='female')throw new Error('TELO_REVIEW_AVATAR must be male or female')
const avatars=requestedAvatar?[requestedAvatar]:['male','female']

async function ensure(directory){await mkdir(directory,{recursive:true});return directory}

const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:{width:980,height:980},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})

try{
  let canvas

  async function setState(next){
    await page.evaluate(state=>window.__teloSquatTechniqueReview?.set(state),next)
    await page.waitForFunction(state=>{
      const status=window.__teloSquatTechniqueReview?.status()
      return status?.state.avatar===state.avatar&&Math.abs(status.state.time-state.time)<.00001&&status.state.view===state.view&&status.state.diagnostic===state.diagnostic
    },next,{timeout:15000})
    await page.evaluate(()=>new Promise(resolveFrame=>requestAnimationFrame(()=>requestAnimationFrame(resolveFrame))))
    await page.waitForTimeout(80)
  }

  const renderManifest={
    renderer:'tools/render-squat-technique-review-browser.mjs',
    source:'original combined Mixamo GLB; read only',
    originalClip:'squat',
    requestedFps:fps,
    videoFormat:'GIF (ffmpeg was not available in the capture environment)',
    avatars:{}
  }

  for(const avatar of avatars){
    console.log(`Rendering ${avatar} review media…`)
    await page.goto(`${url}?avatar=${avatar}`,{waitUntil:'networkidle',timeout:30000})
    await page.waitForFunction(()=>Boolean(window.__teloSquatTechniqueReview),null,{timeout:15000})
    canvas=page.locator('.squat-technique-review-canvas')
    await canvas.waitFor({state:'visible',timeout:15000})
    // `Canvas` renders its first resolved Suspense frame asynchronously. The
    // GLB request has completed at networkidle; leave one quiet render window
    // before taking a deterministic mixer-time capture.
    await page.waitForTimeout(800)
    const detail=phaseData.avatars[avatar]
    const avatarOutput=await ensure(join(output,avatar))
    const controlOutput=await ensure(join(avatarOutput,'control-frames'))
    const diagnosticOutput=await ensure(join(avatarOutput,'diagnostic'))
    const frameRoot=await ensure(join(avatarOutput,'source-frames'))
    const frameCount=Math.ceil(detail.durationSeconds*fps)

    for(const [phase,time] of Object.entries(detail.phases)){
      for(const view of controlViews){
        await setState({avatar,view,time,diagnostic:false})
        await canvas.screenshot({path:join(controlOutput,`${phase}-${view}.png`)})
      }
    }

    // Markers are review-only: pelvis and skeleton reference points for knees,
    // plus arrows from foot to toe. The README explicitly states their limits.
    for(const view of controlViews){
      await setState({avatar,view,time:detail.phases.bottom,diagnostic:true})
      await page.locator('.squat-technique-review-stage').screenshot({path:join(diagnosticOutput,`bottom-${view}-diagnostic.png`)})
    }

    for(const view of views){
      const frameOutput=await ensure(join(frameRoot,view))
      for(let index=0;index<frameCount;index++){
        // Do not duplicate the terminal standing pose. The GIF loops to frame 0
        // and therefore represents the full authored 2.375-second clip once.
        const time=detail.durationSeconds*index/frameCount
        await setState({avatar,view,time,diagnostic:false})
        await canvas.screenshot({path:join(frameOutput,`frame-${String(index).padStart(3,'0')}.png`)})
      }
    }
    renderManifest.avatars[avatar]={
      sourceGlb:detail.source,
      clip:detail.clip,
      durationSeconds:detail.durationSeconds,
      frameCount,
      sampleTimesSeconds:{first:0,last:Number((detail.durationSeconds*(frameCount-1)/frameCount).toFixed(6))},
      controlPhases:detail.phases,
      views
    }
    console.log(`Rendered ${avatar} review media.`)
  }
  if(errors.length)throw new Error(`Browser errors while rendering review media: ${errors.join('\n')}`)
  await writeFile(join(output,'render-manifest.json'),JSON.stringify(renderManifest,null,2)+'\n')
  console.log(JSON.stringify(renderManifest,null,2))
}catch(error){
  const state=await page.evaluate(()=>window.__teloSquatTechniqueReview?.status()||null).catch(()=>null)
  console.error(JSON.stringify({reviewRenderFailed:true,state,errors},null,2))
  throw error
}finally{
  await browser.close()
}
