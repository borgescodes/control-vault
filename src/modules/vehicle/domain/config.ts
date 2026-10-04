export const DEFAULT_TANK_CAPACITY_LITERS = 3.5
export const FUEL_AMOUNT_MARGIN_LITERS = 1
export const RANGE_SAFETY_FACTOR = 0.9
export const SUSPICIOUS_ODOMETER_DELTA_KM = 500
export const MAX_ODOMETER_KM = 999_999
export const MAX_FUEL_INPUT_CENTS = 9_999

export function getMaxFuelAmountCents(
  referencePricePerLiter: number,
  tankCapacityLiters: number,
): number {
  const referencePriceCents = Math.round(
    Number(`${referencePricePerLiter}e2`),
  )

  return Math.round(
    (tankCapacityLiters + FUEL_AMOUNT_MARGIN_LITERS) *
      referencePriceCents,
  )
}
