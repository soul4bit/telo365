import { expect, test } from '@playwright/test'

test('dashboard has no broken images, script errors or horizontal overflow', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: /Твоё тело\.\s*Каждый день\./ })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(await page.locator('img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBeTruthy()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.screenshot({ path: `artifacts/${testInfo.project.name}.png`, fullPage: true })
  expect(errors).toEqual([])
})

test('habits, grocery list and weight persist after reload', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Шаги: не выполнено', exact: true }).click()
  await page.getByRole('button', { name: 'Открыть список', exact: true }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: /Брокколи/ }).check()
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.getByRole('button', { name: /Текущий вес/ }).click()
  await page.getByLabel('Текущий вес, кг').fill('67.5')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: /Текущий вес/ })).toContainText('67,5')
  await expect(page.getByRole('button', { name: 'Шаги: выполнено', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Открыть список', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /Брокколи/ })).toBeChecked()
})

test('search opens recipe, completing workout updates habit', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('textbox', { name: 'Поиск', exact: true }).fill('овсяная')
  await page.locator('.search-results').getByRole('button').click()
  await expect(page.getByRole('dialog')).toContainText('Как приготовить')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Открыть план', exact: true }).click()
  for (const checkbox of await page.getByRole('dialog').getByRole('checkbox').all()) await checkbox.check()
  await expect(page.getByRole('dialog')).toContainText('Завершено 4 из 4')
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Тренировка: выполнено', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('corrupt storage recovers and mobile navigation works', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('telo365-demo-v1', '{broken'))
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Питание на сегодня', exact: true })).toBeVisible()
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
    await page.getByRole('navigation').getByRole('button', { name: 'Профиль', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Твой профиль')
    await page.getByLabel('Как тебя зовут').fill('Алексей')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  }
})
