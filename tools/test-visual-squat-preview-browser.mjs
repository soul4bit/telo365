import { chromium } from 'playwright'

const visualCandidates={
  male:'Мужчина',
  female:'Женщина'
}

const run=async config=>{
  const browser=await chromium.launch({headless:true})
  const page=await browser.newPage(config)
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://127.0.0.1:4174/tools/visual-squat-preview.html',{waitUntil:'networkidle'})
  await page.waitForTimeout(900)
  const controls=page.locator('.exercise-3d-controls')
  if(await controls.count()!==1)throw new Error('Expected viewer controls for the visual candidate')
  await page.getByRole('button',{name:/Пауза/}).click()
  const paused=await page.getByRole('button',{name:/Запустить/}).count()
  await page.getByRole('button',{name:/Запустить/}).click()
  await page.getByRole('button',{name:/Вернуть/}).click()
  await page.getByRole('button',{name:visualCandidates.female}).click()
  await page.waitForTimeout(900)
  const femaleLoaded=await page.getByRole('heading',{name:/Женщина.*приседание/}).count()
  await page.getByRole('button',{name:visualCandidates.male}).click()
  await page.waitForTimeout(500)
  const maleReloaded=await page.getByRole('heading',{name:/Мужчина.*приседание/}).count()
  const result=await page.evaluate(()=>({
    controls:document.querySelectorAll('.exercise-3d-controls').length,
    fallback:document.querySelectorAll('.exercise-3d-fallback').length,
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    width:[document.documentElement.clientWidth,document.documentElement.scrollWidth]
  }))
  await page.screenshot({path:`artifacts/visual-squat-preview-${config.isMobile?'mobile':'desktop'}.png`,fullPage:true})
  await browser.close()
  return {...result,paused,femaleLoaded,maleReloaded,errors}
}

console.log(JSON.stringify({
  desktop:await run({viewport:{width:1280,height:900}}),
  mobile:await run({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
},null,2))
