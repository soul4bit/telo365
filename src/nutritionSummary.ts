export type NutritionDailySummary = {
  dailyCaloriesTarget: number
  consumedCalories: number
  remainingCalories: number
  consumedPercent: number
  remainingPercent: number
}

const finiteNonNegative = (value: number | null | undefined) =>
  Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

/**
 * Produces the single source of truth for the nutrition summary card.
 * A missing daily target deliberately produces zero progress instead of a
 * division-by-zero value.
 */
export function getNutritionDailySummary(
  dailyCaloriesTarget: number | null | undefined,
  consumedCalories: number | null | undefined,
): NutritionDailySummary {
  const target = finiteNonNegative(dailyCaloriesTarget)
  const consumed = finiteNonNegative(consumedCalories)
  const remaining = Math.max(0, target - consumed)

  return {
    dailyCaloriesTarget: target,
    consumedCalories: consumed,
    remainingCalories: remaining,
    consumedPercent: target ? clampPercent(consumed / target * 100) : 0,
    remainingPercent: target ? clampPercent(remaining / target * 100) : 0,
  }
}
