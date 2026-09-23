import { chromium } from 'playwright'

const run=async config=>{
  const browser=await chromium.launch({headless:true})
  const page=await browser.newPage(config)
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://127.0.0.1:4174/tools/trainer-preview.html',{waitUntil:'networkidle'})
  await page.waitForTimeout(900)
  const controls=page.locator('.exercise-3d-controls')
  const activeControls=await controls.count()
  if(activeControls!==1)throw new Error('Expected active controls for the selected candidate')
  await page.getByRole('button',{name:/Пауза/}).click()
  const paused=await page.getByRole('button',{name:/Запустить/}).count()
  await page.getByRole('button',{name:/Запустить/}).click()
  await page.getByRole('button',{name:/Вернуть/}).click()
  await page.getByRole('button',{name:'Женщина'}).click()
  await page.waitForTimeout(900)
  const femaleLoaded=await page.getByRole('heading',{name:/Приседания.*Женщина/}).count()
  await page.getByRole('button',{name:'Мужчина'}).click()
  await page.waitForTimeout(500)
  const maleReloaded=await page.getByRole('heading',{name:/Приседания.*Мужчина/}).count()
  await page.locator('select').selectOption('pushup')
  await page.waitForTimeout(100)
  const missingAnimationMessage=await page.getByText('Анимация для этого тренера ещё не подготовлена').count()
  const result=await page.evaluate(()=>({
    controls:document.querySelectorAll('.exercise-3d-controls').length,
    fallback:document.querySelectorAll('.exercise-3d-fallback').length,
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    width:[document.documentElement.clientWidth,document.documentElement.scrollWidth]
  }))
  await browser.close()
  return {...result,activeControls,paused,femaleLoaded,maleReloaded,missingAnimationMessage,errors}
}

console.log(JSON.stringify({desktop:await run({viewport:{width:1280,height:900}}),mobile:await run({viewport:{width:390,height:844},isMobile:true,hasTouch:true})},null,2))
