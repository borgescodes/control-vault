import type { FullTankAnchor } from './consumption'
import type { FuelEntry } from './types'

export type FuelEstimate = {
  remainingLiters: number
  rangeKm: number
  fuelPercent: number
}

type FuelEstimateInput = {
  nominalTankCapacityLiters: number
  consumptionKmPerLiter: number | null
  initialAnchor: FullTankAnchor | null
  fuelEntries: FuelEntry[]
  currentOdometerKm: number
}

export function estimateFuelRemaining({
  nominalTankCapacityLiters,
  consumptionKmPerLiter,
  initialAnchor,
  fuelEntries,
  currentOdometerKm,
}: FuelEstimateInput): FuelEstimate | null {
  if (
    !Number.isFinite(nominalTankCapacityLiters) ||
    nominalTankCapacityLiters <= 0
  ) {
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
      (!anchor ||
        entry.odometerKm > anchor.odometerKm ||
        (entry.odometerKm === anchor.odometerKm &&
          entry.fueledAt > anchor.at))
    ) {
      anchor = { odometerKm: entry.odometerKm, at: entry.fueledAt }
    }
  }

  if (!anchor) {
    return null
  }

  if (
    !Number.isFinite(currentOdometerKm) ||
    currentOdometerKm < anchor.odometerKm
  ) {
    throw new RangeError('Current odometer cannot precede the latest full tank')
  }

  let remainingLiters = nominalTankCapacityLiters
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

    if (entry.estimatedLiters === null) {
      return null
    }

    remainingLiters = Math.min(
      nominalTankCapacityLiters,
      Math.max(
        0,
        remainingLiters -
          (entry.odometerKm - previousOdometerKm) /
            consumptionKmPerLiter,
      ) + entry.estimatedLiters,
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
    fuelPercent: (remainingLiters / nominalTankCapacityLiters) * 100,
  }
}
