import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base=`http://127.0.0.1:${process.env.TELO_DEV_PORT||'4174'}`
const url=`${base}/tools/mixamo-squat-technique-dialog-preview.html`
const artifacts='artifacts/squat-release-review'
const angles={'Спереди':'front','Сбоку':'side','Сзади':'back','3/4':'three-quarter'}
const report={generatedAt:new Date().toISOString(),scenarios:[],passed:false}
await mkdir(artifacts,{recursive:true})
const browser=await chromium.launch({headless:true})

async function scenario(name,options,run,{query='',setup,expectedNetworkErrors=false}={}){
  const context=await browser.newContext(options),page=await context.newPage(),errors=[],raw=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{
    if(message.type()==='error'&&!(expectedNetworkErrors&&message.text().startsWith('Failed to load resource:')))errors.push(message.text())
  })
  page.on('request',request=>{if(/(?:__telo365-local-review-assets|\.(?:glb|fbx)(?:$|[?#]))/i.test(request.url()))raw.push(request.url())})
  try{
    if(setup)await setup(page)
    await page.goto(url+query,{waitUntil:'domcontentloaded',timeout:30000})
    const dialog=page.locator('dialog.technique-dialog')
    await dialog.waitFor({state:'visible',timeout:15000})
    const result=await run(page,dialog)
    assert.deepEqual(errors,[],`${name}: browser errors`)
    assert.deepEqual(raw,[],`${name}: public viewer requested raw assets`)
    report.scenarios.push({name,passed:true,...result})
    console.log(`${name}: PASS`)
  }catch(error){report.scenarios.push({name,passed:false,error:error.message,errors,raw});throw error}
  finally{await context.close()}
}

async function videoReady(dialog){
  const video=dialog.locator('.exercise-video-viewer video')
  await video.waitFor({state:'visible',timeout:15000})
  await video.evaluate(element=>new Promise((resolve,reject)=>{
    if(element.readyState>=2)return resolve()
    const timeout=setTimeout(()=>reject(new Error('Video did not load')),12000)
    element.addEventListener('loadeddata',()=>{clearTimeout(timeout);resolve()},{once:true})
    element.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('Video load failed'))},{once:true})
  }))
  return video
}

async function media(dialog,avatar,angle){
  const video=await videoReady(dialog)
  const src=await video.locator('source').getAttribute('src')
  assert.equal(new URL(src,url).pathname,`/media/exercises/videos/squat-${avatar}-${angle}.webm`)
  assert.ok(await video.evaluate(element=>Math.abs(element.duration-2.375)<.002),'Video must retain the original clip duration')
  return video
}

async function playback(page,dialog,paused,rate){
  await page.waitForFunction(({paused,rate})=>{
    const video=document.querySelector('.exercise-video-viewer video')
    return video&&video.readyState>=2&&video.paused===paused&&video.playbackRate===rate
  },{paused,rate},{timeout:10000})
  assert.equal(await dialog.getByRole('button',{name:rate===.5?'0.5×':'1×',exact:true}).getAttribute('aria-pressed'),'true')
}

async function angle(dialog,label){
  const button=dialog.getByRole('group',{name:'Ракурс демонстрации'}).getByRole('button',{name:label,exact:true})
  await button.click()
  assert.equal(await button.getAttribute('aria-pressed'),'true')
}

async function noOverflow(page,dialog){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,'Page overflows horizontally')
  assert.equal(await dialog.evaluate(element=>element.scrollWidth>element.clientWidth),false,'Dialog overflows horizontally')
}

async function scrollVisible(dialog,element){
  await element.scrollIntoViewIfNeeded()
  const outer=await dialog.boundingBox(),inner=await element.boundingBox()
  assert.ok(inner&&outer&&inner.y>=outer.y&&inner.y+inner.height<=outer.y+outer.height,'Content cannot be scrolled into view')
}

try{
  await scenario('desktop',{viewport:{width:1280,height:900}},async(page,dialog)=>{
    await media(dialog,'female','three-quarter');await playback(page,dialog,false,1)
    assert.equal(await dialog.getByRole('heading',{name:'Техника: Приседания',exact:true}).count(),1)
    assert.doesNotMatch(await dialog.innerText(),/Mixamo|CH08|Jody|\.glb|test|с опорой/i)
    assert.equal(await dialog.locator('.exercise-video-viewer').getAttribute('data-studio-id'),'telo365-functional-studio-v3')
    assert.equal(await dialog.getByText('TELO365.RU',{exact:true}).count(),0,'No HTML branding overlay')
    assert.equal(await dialog.getByText('ЧАСТЫЕ ОШИБКИ',{exact:true}).count(),1)
    assert.equal(await dialog.getByText('Колени заваливаются внутрь.',{exact:true}).count(),1)
    for(const [label,file] of Object.entries(angles)){
      await angle(dialog,label);await media(dialog,'female',file)
      await dialog.getByRole('button',{name:'Мужчина',exact:true}).click();await media(dialog,'male',file)
      await dialog.getByRole('button',{name:'Женщина',exact:true}).click();await media(dialog,'female',file)
    }
    await dialog.getByRole('button',{name:'0.5×',exact:true}).click();await playback(page,dialog,false,.5)
    await dialog.getByRole('button',{name:'Пауза видео',exact:true}).click();await playback(page,dialog,true,.5)
    const video=await videoReady(dialog),time=await video.evaluate(element=>element.currentTime)
    await page.waitForTimeout(160)
    assert.equal(await video.evaluate(element=>element.currentTime),time,'Pause must freeze time')
    await angle(dialog,'Сбоку')
    await dialog.getByRole('button',{name:'Мужчина',exact:true}).click()
    await media(dialog,'male','side');await playback(page,dialog,true,.5)
    await dialog.getByRole('button',{name:'Запустить видео',exact:true}).click();await playback(page,dialog,false,.5)
    await dialog.getByRole('button',{name:'1×',exact:true}).click();await playback(page,dialog,false,1)
    await page.waitForFunction(()=>document.querySelector('.exercise-video-viewer video')?.currentTime>.4)
    await dialog.getByRole('button',{name:'Вернуть на начало видео',exact:true}).click()
    assert.ok(await dialog.locator('video').evaluate(element=>element.currentTime<.3),'Restart must rewind')
    await dialog.locator('video').evaluate(element=>{element.currentTime=element.duration-.08})
    await page.waitForFunction(()=>{
      const element=document.querySelector('.exercise-video-viewer video')
      return element&&!element.paused&&element.currentTime<.6
    },null,{timeout:4000})
    await angle(dialog,'3/4');await media(dialog,'male','three-quarter')
    await noOverflow(page,dialog)
    await page.screenshot({path:`${artifacts}/squat-video-desktop-male.png`,fullPage:true,animations:'disabled'})
    await dialog.getByRole('button',{name:'Женщина',exact:true}).click();await media(dialog,'female','three-quarter')
    await page.screenshot({path:`${artifacts}/squat-video-desktop-female.png`,fullPage:true,animations:'disabled'})
    await dialog.getByRole('button',{name:'Закрыть',exact:true}).click()
    assert.equal(await page.locator('dialog.technique-dialog').count(),0)
    await page.getByRole('button',{name:'Открыть тестовую модалку',exact:true}).click()
    await media(dialog,'female','three-quarter');await playback(page,dialog,false,1)
    return {bothAvatarsAllAngles:true,angleSpeedPausePreserved:true,reset:true,closeReopen:true}
  })

  for(const [name,width,height] of [['tablet',820,820],['mobile',390,568],['small-mobile',320,480]]){
    await scenario(name,{viewport:{width,height},isMobile:true,hasTouch:true},async(page,dialog)=>{
      await media(dialog,'female','three-quarter')
      const stage=await dialog.locator('.exercise-video-stage').boundingBox(),guidance=await dialog.locator('.technique-guidance').boundingBox()
      assert.ok(guidance.y>=stage.y+stage.height,'Narrow layout must stack guidance below video')
      const buttons=dialog.locator('.exercise-video-controls button, .trainer-avatar-switch button')
      for(const button of await buttons.all()){
        const box=await button.boundingBox()
        assert.ok(box.width>=44&&box.height>=44,`Small touch target ${await button.innerText()}: ${JSON.stringify(box)}`)
      }
      for(const [label,file] of Object.entries(angles)){await angle(dialog,label);await media(dialog,'female',file)}
      await dialog.getByRole('button',{name:'Мужчина',exact:true}).click();await media(dialog,'male','three-quarter')
      await dialog.getByRole('button',{name:'0.5×',exact:true}).click();await playback(page,dialog,false,.5)
      await dialog.evaluate(element=>{element.scrollTop=0})
      await page.screenshot({path:`${artifacts}/squat-video-${name}-top.png`,animations:'disabled'})
      await scrollVisible(dialog,dialog.getByRole('button',{name:'Вернуть на начало видео',exact:true}))
      await scrollVisible(dialog,dialog.getByRole('group',{name:'Ракурс демонстрации'}))
      await dialog.evaluate(element=>{element.scrollTop=element.scrollHeight})
      await scrollVisible(dialog,dialog.locator('.technique-guidance p').last())
      assert.ok(await dialog.evaluate(element=>Math.ceil(element.scrollTop+element.clientHeight)>=element.scrollHeight),'Modal cannot reach bottom')
      await noOverflow(page,dialog)
      await page.screenshot({path:`${artifacts}/squat-video-${name}-bottom.png`,animations:'disabled'})
      return {bothAvatars:true,allAngles:true,touchTargets:true,scrollToBottom:true,noHorizontalOverflow:true}
    })
  }

  await scenario('reduced-motion',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'},async(page,dialog)=>{
    assert.equal(await dialog.locator('video').count(),0)
    assert.equal(await dialog.locator('.exercise-video-static img').count(),1)
    await angle(dialog,'Сбоку');await dialog.getByRole('button',{name:'Мужчина',exact:true}).click()
    assert.match(await dialog.locator('.exercise-video-static img').getAttribute('src'),/squat-male-side/)
    await page.screenshot({path:`${artifacts}/squat-video-reduced-motion.png`,animations:'disabled'})
    await dialog.getByRole('button',{name:'Запустить демонстрацию',exact:true}).click()
    await media(dialog,'male','side');await playback(page,dialog,false,1)
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(100)
    await page.emulateMedia({reducedMotion:'reduce'})
    await dialog.locator('.exercise-video-static img').waitFor()
    assert.equal(await dialog.locator('video').count(),0)
    return {posterOnly:true,manualStart:true,runtimePreferenceChange:true}
  })

  for(const breakPoster of [false,true]){
    await scenario(breakPoster?'video-and-poster-fallback':'video-fallback',{viewport:{width:390,height:844}},async(page,dialog)=>{
      await dialog.getByRole('status').filter({hasText:'временно недоступно'}).waitFor()
      assert.equal(await dialog.locator('video').count(),0)
      if(breakPoster){await dialog.locator('.exercise-video-poster-placeholder').waitFor();assert.equal(await dialog.locator('.exercise-video-static img').count(),0)}
      else assert.equal(await dialog.locator('.exercise-video-static img').count(),1)
      await page.screenshot({path:`${artifacts}/squat-video-fallback-${breakPoster?'no-poster':'poster'}.png`,animations:'disabled'})
      await angle(dialog,'Сбоку');await media(dialog,'female','side');await playback(page,dialog,false,1)
      return {ownFallback:true,recoveryByAngle:true}
    },{expectedNetworkErrors:true,setup:page=>page.route('**/squat-female-three-quarter.*',route=>{
      const pathname=new URL(route.request().url()).pathname
      return pathname.endsWith('.webm')||breakPoster?route.fulfill({status:404,body:'Intentional missing-media regression fixture'}):route.continue()
    })})
  }

  await scenario('partial-one-gender-one-angle',{viewport:{width:390,height:568}},async(page,dialog)=>{
    await media(dialog,'female','side');await playback(page,dialog,false,1)
    assert.equal(await dialog.getByRole('button',{name:'Мужчина',exact:true}).count(),0)
    assert.equal(await dialog.getByRole('button',{name:'Женщина',exact:true}).getAttribute('aria-pressed'),'true')
    assert.equal(await dialog.getByRole('group',{name:'Ракурс демонстрации'}).count(),0)
    await noOverflow(page,dialog)
    return {storedMissingGenderFallback:true,onlyAvailableControls:true}
  },{query:'?media=single-angle&avatar=male'})

  await scenario('partial-missing-angle',{viewport:{width:1280,height:900}},async(page,dialog)=>{
    await media(dialog,'female','three-quarter');await angle(dialog,'Сбоку')
    await dialog.getByRole('button',{name:'Мужчина',exact:true}).click();await media(dialog,'male','three-quarter')
    assert.equal(await dialog.getByRole('button',{name:'Сбоку',exact:true}).count(),0)
    assert.equal(await dialog.getByRole('button',{name:'3/4',exact:true}).getAttribute('aria-pressed'),'true')
    await dialog.getByRole('button',{name:'Женщина',exact:true}).click();await media(dialog,'female','side')
    return {sameExerciseFallback:true,requestedAngleRestored:true}
  },{query:'?media=missing-male-side'})

  for(const [name,query,title] of [['missing-media','?media=empty','Техника: Приседания'],['empty-angle-registry','?media=empty-angles','Техника: Приседания'],['box-squat','?exercise=box-squat','Техника: Приседания до скамьи']]){
    await scenario(name,{viewport:{width:390,height:568}},async(page,dialog)=>{
      assert.equal(await dialog.getByRole('heading',{name:title,exact:true}).count(),1)
      assert.equal(await dialog.locator('.exercise-video-viewer').count(),0)
      assert.equal(await dialog.locator('video, img[src*="squat-"]').count(),0)
      assert.equal(await dialog.getByRole('button',{name:'Мужчина',exact:true}).count(),0)
      assert.equal(await dialog.locator('.technique-guidance').count(),1)
      await noOverflow(page,dialog)
      return {ownExerciseFallback:true,noAirSquatMedia:true}
    },{query})
  }

  await scenario('historical-squat-label',{viewport:{width:1280,height:900}},async(page,dialog)=>{
    await media(dialog,'female','three-quarter')
    assert.equal(await dialog.getByRole('heading',{name:'Техника: Приседания',exact:true}).count(),1)
    assert.doesNotMatch(await dialog.innerText(),/с опорой/)
    return {canonicalTitle:true,exerciseIdPreserved:true}
  },{query:'?label=legacy'})
  report.passed=true
}finally{
  await browser.close()
  await writeFile(`${artifacts}/browser-regression-results.json`,JSON.stringify(report,null,2)+'\n')
}
console.log(`Browser regressions PASS: ${report.scenarios.length} scenarios`)
