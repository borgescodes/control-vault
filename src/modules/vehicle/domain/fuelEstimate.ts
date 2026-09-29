import type { FullTankAnchor } from './consumption'
import type { FuelEntry } from './types'

export type FuelEstimate = {
  remainingLiters: number
  rangeKm: number
  fuelPercent: number
}

type FuelEstimateInput = {
  tankCapacityLiters: number
  consumptionKmPerLiter: number | null
  initialAnchor: FullTankAnchor
  fuelEntries: FuelEntry[]
  currentOdometerKm: number
}

export function estimateFuelRemaining({
  tankCapacityLiters,
  consumptionKmPerLiter,
  initialAnchor,
  fuelEntries,
  currentOdometerKm,
}: FuelEstimateInput): FuelEstimate | null {
  if (!Number.isFinite(tankCapacityLiters) || tankCapacityLiters <= 0) {
    throw new RangeError('Tank capacity must be greater than zero')
  }

  if (consumptionKmPerLiter === null) {
    return null
  }

  if (
    !Number.isFinite(consumptionKmPerLiter) ||
    consumptionKmPerLiter <= 0
  ) {
    throw new RangeError('Consumption must be greater than zero')
  }

  const entries = [...fuelEntries].sort(
    (left, right) =>
      left.odometerKm - right.odometerKm ||
      left.fueledAt.localeCompare(right.fueledAt),
  )
  let anchor = initialAnchor

  for (const entry of entries) {
    if (
      entry.fullTank &&
      (entry.odometerKm > anchor.odometerKm ||
        (entry.odometerKm === anchor.odometerKm &&
          entry.fueledAt > anchor.at))
    ) {
      anchor = { odometerKm: entry.odometerKm, at: entry.fueledAt }
    }
  }

  if (
    !Number.isFinite(currentOdometerKm) ||
    currentOdometerKm < anchor.odometerKm
  ) {
    throw new RangeError('Current odometer cannot precede the latest full tank')
  }

  let remainingLiters = tankCapacityLiters
  let previousOdometerKm = anchor.odometerKm
  for (const entry of entries) {
    const followsAnchor =
      entry.odometerKm > anchor.odometerKm ||
      (entry.odometerKm === anchor.odometerKm && entry.fueledAt > anchor.at)
    if (
      entry.fullTank ||
      !followsAnchor ||
      entry.odometerKm > currentOdometerKm
    ) {
      continue
    }

    remainingLiters = Math.min(
      tankCapacityLiters,
      Math.max(
        0,
        remainingLiters -
          (entry.odometerKm - previousOdometerKm) /
            consumptionKmPerLiter,
      ) + entry.liters,
    )
    previousOdometerKm = entry.odometerKm
  }

  remainingLiters = Math.max(
    0,
    remainingLiters -
      (currentOdometerKm - previousOdometerKm) / consumptionKmPerLiter,
  )

  return {
    remainingLiters,
    rangeKm: remainingLiters * consumptionKmPerLiter,
    fuelPercent: (remainingLiters / tankCapacityLiters) * 100,
  }
}
