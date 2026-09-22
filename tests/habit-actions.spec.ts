import { test, expect } from '@playwright/test'
async function finishOnboarding(page:any){
  await expect(page.getByRole('heading',{name:'\u0420\u0430\u0441\u0441\u043a\u0430\u0436\u0438 \u043d\u0435\u043c\u043d\u043e\u0433\u043e \u043e \u0441\u0435\u0431\u0435'})).toBeVisible()
  await page.getByLabel('\u0412\u043e\u0437\u0440\u0430\u0441\u0442',{exact:true}).fill('30')
  await page.getByLabel('\u0420\u043e\u0441\u0442, \u0441\u043c',{exact:true}).fill('170')
  await page.getByLabel('\u0412\u0435\u0441, \u043a\u0433',{exact:true}).fill('70')
  await page.getByRole('button',{name:'\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c',exact:true}).click({force:true})
  await page.getByRole('button',{name:'\u0421\u043d\u0438\u0437\u0438\u0442\u044c \u0432\u0435\u0441',exact:true}).click({force:true})
  for(let i=0;i<2;i++)await page.getByRole('button',{name:'\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c',exact:true}).click({force:true})
  await page.getByRole('button',{name:'\u041d\u043e\u0432\u0438\u0447\u043e\u043a',exact:true}).click({force:true})
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c',exact:true}).click({force:true})
  await page.getByRole('button',{name:'\u0421\u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043c\u043e\u0439 \u043f\u043b\u0430\u043d',exact:true}).click({force:true})
  await page.getByRole('button',{name:'\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u043c\u043e\u0439 \u0434\u0435\u043d\u044c',exact:true}).click({force:true})
}


test('home habit actions open editors', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Как тебя зовут').fill('Тест')
  await page.getByLabel('Email').fill(`habit-${Date.now()}@example.test`)
  await page.getByLabel('Пароль').fill('correct-horse-battery-staple')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.getByRole('checkbox', { name: /Я сохранил резервный код/ }).check()
  await page.getByRole('button', { name: 'Перейти в кабинет' }).click()
  await finishOnboarding(page)
  await expect(page.getByRole('heading', { name: 'Привычки за день' })).toBeVisible()
  await page.getByRole('button', { name: 'Новая' }).click()
  await expect(page.getByRole('dialog', { name: 'Новая привычка' })).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await page.getByRole('button', { name: /Настроить привычку/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Настроить привычку' })).toBeVisible()
})
