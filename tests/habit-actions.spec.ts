import { test, expect } from '@playwright/test'

test('home habit actions open editors', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Как тебя зовут').fill('Тест')
  await page.getByLabel('Email').fill(`habit-${Date.now()}@example.test`)
  await page.getByLabel('Пароль').fill('correct-horse-battery-staple')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.getByRole('checkbox', { name: /Я сохранил резервный код/ }).check()
  await page.getByRole('button', { name: 'Перейти в кабинет' }).click()
  await expect(page.getByRole('heading', { name: 'Привычки за день' })).toBeVisible()
  await page.getByRole('button', { name: 'Новая' }).click()
  await expect(page.getByRole('dialog', { name: 'Новая привычка' })).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await page.getByRole('button', { name: /Настроить привычку/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Настроить привычку' })).toBeVisible()
})
