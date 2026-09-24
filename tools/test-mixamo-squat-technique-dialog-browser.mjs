import { chromium } from 'playwright'

const devBase=`http://127.0.0.1:${process.env.TELO_DEV_PORT||'4174'}`
const url=`${devBase}/tools/mixamo-squat-technique-dialog-preview.html?mode=developer`
const regularUrl=`${devBase}/tools/mixamo-squat-technique-dialog-preview.html`
const initialFrameUrl=`${devBase}/tools/mixamo-squat-technique-dialog-preview.html?mode=developer&frame=initial`

async function waitForViewer(page,dialog){
  await page.waitForFunction(()=>document.querySelectorAll('dialog.technique-dialog .exercise-3d-skeleton').length===0||document.querySelectorAll('dialog.technique-dialog .exercise-3d-fallback').length===1,null,{timeout:15000})
  const canvas=await dialog.locator('canvas').count(),fallback=await dialog.locator('.exercise-3d-fallback').count()
  if(canvas!==1||fallback)throw new Error(`viewer did not load (canvas=${canvas}, fallback=${fallback})`)
}

async function initialFrames(){
  const browser=await chromium.launch({headless:true})
  const page=await browser.newPage({viewport:{width:1280,height:900}})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(initialFrameUrl,{waitUntil:'domcontentloaded',timeout:30000})
  const dialog=page.locator('dialog.technique-dialog');await dialog.waitFor({state:'visible',timeout:10000})
  await waitForViewer(page,dialog)
  const controls=dialog.locator('.exercise-3d-controls button')
  const initialPause=await controls.nth(0).getAttribute('aria-label')
  // The first button exposes "start", rather than "pause", only when the
  // AnimationMixer is frozen at the authored time zero.
  if(!initialPause?.includes('Запустить'))throw new Error(`initial frame is not paused: ${initialPause||'missing aria label'}`)
  await page.screenshot({path:'artifacts/mixamo-air-squat-initial-female-modal.png',fullPage:false})
  await page.locator('.mixamo-avatar-switch button').nth(1).click()
  await page.waitForTimeout(80);await waitForViewer(page,dialog)
  const malePause=await controls.nth(0).getAttribute('aria-label')
  if(!malePause?.includes('Запустить'))throw new Error(`male initial frame is not paused: ${malePause||'missing aria label'}`)
  await page.screenshot({path:'artifacts/mixamo-air-squat-initial-male-modal.png',fullPage:false})
  await browser.close()
  return {femalePausedAtZero:true,malePausedAtZero:true,errors}
}

async function mobileScroll(){
  const browser=await chromium.launch({headless:true})
  const page=await browser.newPage({viewport:{width:390,height:568},isMobile:true,hasTouch:true})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  const dialog=page.locator('dialog.technique-dialog');await dialog.waitFor({state:'visible',timeout:10000})
  await waitForViewer(page,dialog)
  const head=dialog.locator('.dialog-head')
  const headBox=await head.boundingBox()
  if(!headBox)throw new Error('dialog header has no measurable box')
  await dialog.evaluate(element=>{element.scrollTop=0})
  await page.mouse.move(headBox.x+headBox.width*.5,headBox.y+Math.min(12,headBox.height*.5))
  await page.mouse.wheel(0,600)
  await page.waitForTimeout(80)
  const wheelScrollTop=await dialog.evaluate(element=>element.scrollTop)
  if(wheelScrollTop<=0)throw new Error('vertical scroll did not start from the modal header')
  await dialog.evaluate(element=>{element.scrollTop=element.scrollHeight})
  await page.waitForTimeout(80)
  const measurements=await dialog.evaluate(element=>{
    const rect=element.getBoundingClientRect()
    const status=element.querySelector('.mixamo-technique-status')?.getBoundingClientRect()
    const canvas=element.querySelector('canvas')?.getBoundingClientRect()
    const controls=element.querySelector('.exercise-3d-controls')?.getBoundingClientRect()
    return {
      scrollTop:element.scrollTop,
      scrollHeight:element.scrollHeight,
      clientHeight:element.clientHeight,
      atBottom:Math.ceil(element.scrollTop+element.clientHeight)>=element.scrollHeight,
      statusVisible:!!status&&status.top>=rect.top&&status.bottom<=rect.bottom,
      controlsBelowCanvas:!!canvas&&!!controls&&controls.top>=canvas.bottom,
      dialogBottom:rect.bottom,
      statusBottom:status?.bottom||null
    }
  })
  if(!measurements.atBottom||!measurements.statusVisible||!measurements.controlsBelowCanvas)throw new Error(`mobile bottom content is not reachable: ${JSON.stringify(measurements)}`)
  await page.screenshot({path:'artifacts/mixamo-squat-technique-dialog-mobile-bottom-scrolled.png',fullPage:false})
  await browser.close()
  return {...measurements,wheelScrollTop,errors}
}

async function regular(config){
  const browser=await chromium.launch({headless:true})
  const page=await browser.newPage(config)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(regularUrl,{waitUntil:'domcontentloaded',timeout:30000})
  const dialog=page.locator('dialog.technique-dialog');await dialog.waitFor({state:'visible',timeout:10000})
  await page.waitForFunction(()=>document.querySelectorAll('dialog.technique-dialog .exercise-3d-skeleton').length===0||document.querySelectorAll('dialog.technique-dialog .exercise-3d-fallback').length===1,null,{timeout:15000})
  const canvas=await dialog.locator('canvas').count(),fallback=await dialog.locator('.exercise-3d-fallback').count()
  const tabs=await dialog.locator('.technique-view-switch').count(),switches=await dialog.locator('.mixamo-avatar-switch').count()
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)
  if(canvas!==0||fallback!==1||tabs||switches||overflow)throw new Error(`regular dialog mismatch (canvas=${canvas}, fallback=${fallback}, tabs=${tabs}, switches=${switches}, overflow=${overflow})`)
  await page.screenshot({path:`artifacts/mixamo-single-trainer-${config.isMobile?'mobile':'desktop'}.png`,fullPage:true})
  await browser.close()
  return {canvas,fallback,tabs,switches,horizontalOverflow:overflow,errors}
}

async function run(config){
  const browser=await chromium.launch({headless:true})
  const page=await browser.newPage(config)
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  const dialog=page.locator('dialog.technique-dialog')
  await dialog.waitFor({state:'visible',timeout:10000})
  const review=async index=>{
    await page.locator('.mixamo-avatar-switch button').nth(index).click()
    await page.waitForTimeout(100)
    await waitForViewer(page,dialog)
  }
  const controls=dialog.locator('.exercise-3d-controls button')
  const capturePoses=async avatar=>{
    // The source clip remains untouched. These are visual references for its
    // lower and upright phases; exact time zero is covered separately above.
    await controls.nth(1).click(); await page.waitForTimeout(40); await controls.nth(0).click(); await page.waitForTimeout(40)
    await page.screenshot({path:`artifacts/mixamo-squat-technique-dialog-${config.isMobile?'mobile':'desktop'}-${avatar}-bottom.png`,fullPage:true})
    // The upright reference occurs around the middle of this 2.375-second
    // original source clip. Resume only for that interval, then pause.
    await controls.nth(0).click(); await page.waitForTimeout(1110); await controls.nth(0).click(); await page.waitForTimeout(40)
    await page.screenshot({path:`artifacts/mixamo-squat-technique-dialog-${config.isMobile?'mobile':'desktop'}-${avatar}-standing.png`,fullPage:true})
  }
  await review(0); await capturePoses('female')
  await review(1); await capturePoses('male')
  if((await controls.nth(0).getAttribute('aria-label'))?.includes('Запустить'))await controls.nth(0).click()
  const pauseLabel=await controls.nth(0).getAttribute('aria-label')
  if(!pauseLabel?.includes('Пауза'))throw new Error(`expected running animation before pause, got ${pauseLabel||'missing aria label'}`)
  await controls.nth(0).click()
  const startLabel=await controls.nth(0).getAttribute('aria-label')
  if(!startLabel?.includes('Запустить'))throw new Error(`Play/Pause did not pause animation: ${startLabel||'missing aria label'}`)
  await controls.nth(0).click()
  const resumedLabel=await controls.nth(0).getAttribute('aria-label')
  if(!resumedLabel?.includes('Пауза'))throw new Error(`Play/Pause did not resume animation: ${resumedLabel||'missing aria label'}`)
  await controls.nth(1).click()
  await controls.nth(2).click()
  if(!await controls.nth(2).evaluate(button=>button.classList.contains('is-active')))throw new Error('0.5× speed did not become active')
  await controls.nth(3).click()
  if(!await controls.nth(3).evaluate(button=>button.classList.contains('is-active')))throw new Error('1× speed did not become active')
  const canvas=dialog.locator('canvas'),box=await canvas.boundingBox()
  if(!box)throw new Error('Viewer canvas has no measurable box')
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.42);await page.mouse.down();await page.mouse.move(box.x+box.width*.62,box.y+box.height*.47,{steps:6});await page.mouse.up()
  const result=await page.evaluate(()=>({dialog:!!document.querySelector('dialog.technique-dialog[open]'),fallback:document.querySelectorAll('.exercise-3d-fallback').length,canvases:document.querySelectorAll('dialog.technique-dialog canvas').length,horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,dimensions:[document.documentElement.clientWidth,document.documentElement.scrollWidth]}))
  await page.screenshot({path:`artifacts/mixamo-squat-technique-dialog-${config.isMobile?'mobile':'desktop'}.png`,fullPage:true})
  await browser.close()
  return {...result,playPause:true,reset:true,speeds:[.5,1],errors}
}

async function reduced(){
  const browser=await chromium.launch({headless:true})
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  const dialog=page.locator('dialog.technique-dialog');await dialog.waitFor({state:'visible',timeout:10000})
  await page.waitForFunction(()=>document.querySelectorAll('.exercise-3d-fallback').length===1||document.querySelectorAll('dialog.technique-dialog canvas').length===1,null,{timeout:15000})
  const fallback=await dialog.locator('.exercise-3d-fallback').count(),canvas=await dialog.locator('canvas').count()
  await browser.close()
  if(fallback!==1||canvas!==0)throw new Error(`reduced-motion fallback mismatch (canvas=${canvas}, fallback=${fallback})`)
  return {fallback,canvas,errors}
}

const target=process.env.TELO_DIALOG_TEST_MODE||'all'
const result={}
if(target==='all'||target==='desktop')result.desktop=await run({viewport:{width:1280,height:900}})
if(target==='all'||target==='mobile')result.mobile=await run({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
if(target==='all'||target==='reduced')result.reducedMotion=await reduced()
if(target==='all'||target==='initial')result.initialFrames=await initialFrames()
if(target==='all'||target==='mobile-scroll')result.mobileScroll=await mobileScroll()
if(target==='regular-desktop')result.regularDesktop=await regular({viewport:{width:1280,height:900}})
if(target==='regular-mobile')result.regularMobile=await regular({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
console.log(JSON.stringify(result,null,2))
