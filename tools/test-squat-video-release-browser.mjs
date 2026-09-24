import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const base=`http://127.0.0.1:${process.env.TELO_DEV_PORT||'4174'}`
const url=`${base}/tools/mixamo-squat-technique-dialog-preview.html`
const artifacts='artifacts/squat-release-review'

async function waitForVideo(dialog){
  const video=dialog.locator('.exercise-video-viewer video')
  await video.waitFor({state:'visible',timeout:15000})
  await video.evaluate(element=>new Promise((resolve,reject)=>{
    if(element.readyState>=2)return resolve()
    element.addEventListener('loadeddata',()=>resolve(),{once:true})
    element.addEventListener('error',()=>reject(new Error('release video failed to load')),{once:true})
  }))
  return video
}

async function desktop(){
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],rawAssetRequests=[]
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  page.on('request',request=>{if(/(?:__telo365-local-review-assets|mixamo-.*\.glb|\.glb(?:$|[?#]))/i.test(request.url()))rawAssetRequests.push(request.url())})
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  const dialog=page.locator('dialog.technique-dialog');await dialog.waitFor({state:'visible',timeout:10000})
  const video=await waitForVideo(dialog)
  const text=await dialog.innerText()
  if(/Mixamo|CH08|Jody|\.glb|test/i.test(text))throw new Error(`technical text leaked into the release dialog: ${text}`)
  const source=async()=>{
    const current=dialog.locator('.exercise-video-viewer video')
    await current.waitFor({state:'visible',timeout:15000})
    return await current.getAttribute('src')||await current.locator('source').getAttribute('src')
  }
  const sourcePath=(value)=>new URL(value||'',url).pathname
  const initialSource=await source()
  if(sourcePath(initialSource)!=='/media/exercises/videos/squat-female-three-quarter.webm')throw new Error(`expected default female 3/4 video, got ${initialSource}`)
  if(!await dialog.getByRole('heading',{name:'Техника: Приседания',exact:true}).isVisible())throw new Error('Air Squat dialog title is not canonical')
  if(/с опорой/i.test(await dialog.innerText()))throw new Error('Air Squat dialog still exposes a supported-squat label')
  const angles={
    'Спереди':'front',
    'Сбоку':'side',
    'Сзади':'back',
    '3/4':'three-quarter'
  }
  const angleSwitch=dialog.getByRole('group',{name:'Ракурс демонстрации'})
  for(const [label,fileAngle] of Object.entries(angles)){
    await angleSwitch.getByRole('button',{name:label}).click()
    const current=await source()
    if(sourcePath(current)!==`/media/exercises/videos/squat-female-${fileAngle}.webm`)throw new Error(`female ${label} view did not load: ${current}`)
  }
  if(await dialog.locator('.exercise-video-viewer').getAttribute('data-studio-id')!=='telo365-functional-studio-v3')throw new Error('functional studio metadata is missing')
  if(await dialog.getByText('TELO365.RU',{exact:true}).count())throw new Error('physical studio branding must not use an HTML overlay')
  if(!await dialog.getByText('\u0427\u0410\u0421\u0422\u042b\u0415 \u041e\u0428\u0418\u0411\u041a\u0418',{exact:true}).isVisible())throw new Error('exercise mistakes metadata is not visible')
  if(!await dialog.getByText('\u041a\u043e\u043b\u0435\u043d\u0438 \u0437\u0430\u0432\u0430\u043b\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u0432\u043d\u0443\u0442\u0440\u044c.',{exact:true}).isVisible())throw new Error('Air Squat mistakes are not rendered from metadata')
  await dialog.getByRole('button',{name:'Мужчина'}).click()
  await waitForVideo(dialog)
  const maleSource=await source()
  if(sourcePath(maleSource)!=='/media/exercises/videos/squat-male-three-quarter.webm')throw new Error(`avatar switch did not restore male 3/4 video: ${maleSource}`)
  for(const [label,fileAngle] of Object.entries(angles)){
    await angleSwitch.getByRole('button',{name:label}).click()
    const current=await source()
    if(sourcePath(current)!==`/media/exercises/videos/squat-male-${fileAngle}.webm`)throw new Error(`male ${label} view did not load: ${current}`)
  }
  if(!await dialog.locator('.technique-guidance').isVisible())throw new Error('technique guidance is not visible beside the release video')
  const controls=dialog.locator('.exercise-video-controls')
  await controls.getByRole('button',{name:'Пауза видео'}).click()
  await controls.getByRole('button',{name:'Запустить видео'}).click()
  await controls.getByRole('button',{name:'Вернуть на начало видео'}).click()
  await controls.getByRole('button',{name:'1×'}).click()
  if(!await controls.getByRole('button',{name:'1×'}).evaluate(element=>element.classList.contains('is-active')))throw new Error('1× control did not become active')
  await page.screenshot({path:`${artifacts}/squat-video-desktop-male.png`,fullPage:true})
  await dialog.locator('button[aria-label="Закрыть"]').click()
  if(await page.locator('dialog.technique-dialog').count())throw new Error('technique dialog did not close')
  await browser.close()
  if(errors.length)throw new Error(`desktop console errors: ${errors.join(' | ')}`)
  if(rawAssetRequests.length)throw new Error(`release dialog requested raw review asset: ${rawAssetRequests.join(', ')}`)
  return {avatarSwitch:true,angleSwitch:true,embeddedStudioBranding:true,techniqueMetadata:true,playPause:true,reset:true,speed:true,dialogClose:true}
}

async function mobile(){
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:568},isMobile:true,hasTouch:true}),errors=[]
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  const dialog=page.locator('dialog.technique-dialog');await dialog.waitFor({state:'visible',timeout:10000});await waitForVideo(dialog)
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)
  if(overflow)throw new Error('mobile page has horizontal overflow')
  await dialog.evaluate(element=>{element.scrollTop=element.scrollHeight})
  await page.waitForTimeout(80)
  const result=await dialog.evaluate(element=>{
    const box=element.getBoundingClientRect(),guidance=element.querySelector('.technique-guidance')?.getBoundingClientRect(),controls=element.querySelector('.exercise-video-controls')?.getBoundingClientRect(),angles=element.querySelector('.exercise-video-angle-switch')?.getBoundingClientRect()
    return {atBottom:Math.ceil(element.scrollTop+element.clientHeight)>=element.scrollHeight,guidanceVisible:!!guidance&&guidance.bottom<=box.bottom&&guidance.top>=box.top,controlsVisible:!!controls&&controls.bottom<=box.bottom&&controls.top>=box.top,anglesVisible:!!angles&&angles.bottom<=box.bottom&&angles.top>=box.top}
  })
  if(!result.atBottom||!result.guidanceVisible||!result.anglesVisible)throw new Error(`mobile modal bottom is inaccessible: ${JSON.stringify(result)}`)
  await page.screenshot({path:`${artifacts}/squat-video-mobile-bottom.png`,fullPage:false})
  await browser.close()
  if(errors.length)throw new Error(`mobile console errors: ${errors.join(' | ')}`)
  return {...result,horizontalOverflow:overflow}
}

async function reducedMotion(){
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'})
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  const dialog=page.locator('dialog.technique-dialog');await dialog.waitFor({state:'visible',timeout:10000})
  const video=await dialog.locator('.exercise-video-viewer video').count(),poster=await dialog.locator('.exercise-video-static img').count()
  if(video||poster!==1)throw new Error(`reduced-motion release fallback mismatch (video=${video}, poster=${poster})`)
  await dialog.getByRole('button',{name:'\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u044e'}).click()
  await waitForVideo(dialog)
  const startedVideo=await dialog.locator('.exercise-video-viewer video').count()
  await browser.close()
  if(startedVideo!==1)throw new Error('reduced-motion user action did not start the demonstration')
  return {video,poster,manualStart:true}
}

await mkdir(artifacts,{recursive:true})
console.log(JSON.stringify({desktop:await desktop(),mobile:await mobile(),reducedMotion:await reducedMotion()},null,2))
