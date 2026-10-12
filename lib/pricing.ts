import type { UsdRates } from "@/lib/fx"

/** Raw values at or below this are scraper placeholders (e.g. "1.00 NGN"), never real prices. */
export const PLACEHOLDER_MAX = 1

/**
 * Single source of truth for "is this quote usable as a lowest price?".
 * Mirrors the SQL rules in lib/db/queries.ts so the homepage, /tlds and detail pages agree.
 * Returns the USD amount, or null when the quote must be ignored.
 */
export function usablePriceUsd(
  value: string | number | null | undefined,
  currency: string,
  rates: UsdRates,
  options: { isPromotion?: boolean; rawRegister?: string | number | null } = {},
): number | null {
  if (value == null) return null
  const amount = typeof value === "number" ? value : Number.parseFloat(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const rate = currency === "USD" ? 1 : rates[currency]
  if (!rate || rate <= 0) return null

  const baseline = options.rawRegister ?? (options.isPromotion ? null : amount)
  if (baseline != null && Number(baseline) <= PLACEHOLDER_MAX) return null

  const usd = amount / rate
  if (usd < 1 && !options.isPromotion) return null
  return usd
}
