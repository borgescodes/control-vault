export const NOMINAL_TANK_CAPACITY_LITERS = 3
export const FUEL_AMOUNT_MARGIN_LITERS = 1
export const RANGE_SAFETY_FACTOR = 0.9
export const SUSPICIOUS_ODOMETER_DELTA_KM = 500
export const MAX_ODOMETER_KM = 999_999
export const MAX_FUEL_INPUT_CENTS = 9_999

export function getMaxFuelAmountCents(referencePricePerLiter: number): number {
  const referencePriceCents = Math.round(
    Number(`${referencePricePerLiter}e2`),
  )

  return (
    (NOMINAL_TANK_CAPACITY_LITERS + FUEL_AMOUNT_MARGIN_LITERS) *
    referencePriceCents
  )
}
