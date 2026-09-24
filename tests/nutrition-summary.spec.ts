import { expect, test } from '@playwright/test'
import { getNutritionDailySummary } from '../src/nutritionSummary'

test.describe('nutrition daily summary', () => {
  test('calculates progress from the same target and consumed values', () => {
    expect(getNutritionDailySummary(2500, 0)).toMatchObject({
      consumedCalories: 0,
      remainingCalories: 2500,
      consumedPercent: 0,
      remainingPercent: 100,
    })

    expect(getNutritionDailySummary(2600, 646)).toMatchObject({
      consumedCalories: 646,
      remainingCalories: 1954,
      consumedPercent: 25,
      remainingPercent: 75,
    })
  })

  test('clamps an achieved or exceeded target without overflowing progress', () => {
    expect(getNutritionDailySummary(2600, 2600)).toMatchObject({
      consumedPercent: 100,
      remainingCalories: 0,
      remainingPercent: 0,
    })
    expect(getNutritionDailySummary(2600, 3000)).toMatchObject({
      consumedPercent: 100,
      remainingCalories: 0,
      remainingPercent: 0,
    })
  })

  test('keeps progress safe when the user has no daily target', () => {
    expect(getNutritionDailySummary(null, 646)).toMatchObject({
      dailyCaloriesTarget: 0,
      consumedCalories: 646,
      remainingCalories: 0,
      consumedPercent: 0,
      remainingPercent: 0,
    })
  })
})
