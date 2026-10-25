export const DEFAULT_TANK_CAPACITY_LITERS = 3
export const FUEL_AMOUNT_MARGIN_LITERS = 1
/** Additional tolerance for pump-reported volume; not physical tank capacity. */
export const FUEL_VOLUME_INPUT_MARGIN_LITERS = 0.5

export function getMaxFuelInputLiters(nominalTankCapacityLiters: number): number {
  return Math.round((nominalTankCapacityLiters + FUEL_VOLUME_INPUT_MARGIN_LITERS) * 1000) / 1000
}
export const RANGE_SAFETY_FACTOR = 0.9
export const SUSPICIOUS_ODOMETER_DELTA_KM = 500
export const MAX_ODOMETER_KM = 999_999
export const MAX_FUEL_INPUT_CENTS = 9_999
export const MAX_TANK_CAPACITY_LITERS = 99.99

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
