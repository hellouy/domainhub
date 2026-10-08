export type RegistrarScoreInput = {
  tldCount: number
  promoCount: number
  completeCount: number
  icannAccredited: boolean
  whoisPrivacy: boolean
  dnssec: boolean
  paymentMethodCount: number
  healthScore: number | null
}

export type RegistrarScoreBreakdown = {
  coverage: number
  promo: number
  completeness: number
  capability: number
  health: number
}

export type RegistrarScore = {
  score: number
  breakdown: RegistrarScoreBreakdown
}

const WEIGHTS = {
  coverage: 35,
  promo: 25,
  completeness: 15,
  capability: 15,
  health: 10,
} as const

/** 500+ 后缀覆盖得满分，对数刻度平滑衰减 */
const COVERAGE_FULL_AT = 500

export function computeRegistrarScore(input: RegistrarScoreInput): RegistrarScore {
  const tldCount = Math.max(0, input.tldCount)
  const promoCount = Math.max(0, input.promoCount)
  const completeCount = Math.max(0, input.completeCount)

  const coverage = Math.min(1, Math.log10(tldCount + 1) / Math.log10(COVERAGE_FULL_AT + 1))

  const promoRatio = tldCount > 0 ? promoCount / tldCount : 0
  const promo = Math.min(1, promoRatio * 1.5)

  const completeness = tldCount > 0 ? Math.min(1, completeCount / tldCount) : 0

  const capability =
    ((input.icannAccredited ? 1 : 0) +
      (input.whoisPrivacy ? 1 : 0) +
      (input.dnssec ? 1 : 0) +
      Math.min(input.paymentMethodCount, 4) / 4) /
    4

  const health =
    input.healthScore == null
      ? 0.5
      : Math.min(1, Math.max(0, input.healthScore / 100))

  const score = Math.round(
    WEIGHTS.coverage * coverage +
      WEIGHTS.promo * promo +
      WEIGHTS.completeness * completeness +
      WEIGHTS.capability * capability +
      WEIGHTS.health * health,
  )

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown: { coverage, promo, completeness, capability, health },
  }
}
