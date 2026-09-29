import type { FuelEntry } from './types'

export type FullTankAnchor = {
  odometerKm: number
  at: string
}

export type ConsumptionCycle = {
  startKm: number
  endKm: number
  distanceKm: number
  fuelUsedLiters: number
  kmPerLiter: number
}

export type CalibrationState = 'calibrating' | 'estimated' | 'calibrated'

export type ConsumptionEstimate = {
  kmPerLiter: number
  calibrationState: CalibrationState
  cycleCount: number
}

export function buildConsumptionCycles(
  initialAnchor: FullTankAnchor,
  fuelEntries: FuelEntry[],
): ConsumptionCycle[] {
  const entries = [...fuelEntries].sort(
    (left, right) =>
      left.odometerKm - right.odometerKm ||
      left.fueledAt.localeCompare(right.fueledAt),
  )
  const cycles: ConsumptionCycle[] = []
  let anchor = initialAnchor
  let fuelUsedLiters = 0

  for (const entry of entries) {
    if (
      entry.odometerKm < anchor.odometerKm ||
      (entry.odometerKm === anchor.odometerKm && entry.fueledAt <= anchor.at)
    ) {
      continue
    }

    fuelUsedLiters += entry.liters

    if (!entry.fullTank) {
      continue
    }

    const distanceKm = entry.odometerKm - anchor.odometerKm
    const kmPerLiter = distanceKm / fuelUsedLiters

    if (
      distanceKm > 0 &&
      fuelUsedLiters > 0 &&
      Number.isFinite(kmPerLiter)
    ) {
      cycles.push({
        startKm: anchor.odometerKm,
        endKm: entry.odometerKm,
        distanceKm,
        fuelUsedLiters,
        kmPerLiter,
      })
    }

    anchor = { odometerKm: entry.odometerKm, at: entry.fueledAt }
    fuelUsedLiters = 0
  }

  return cycles
}

export function learnConsumption(
  cycles: ConsumptionCycle[],
): ConsumptionEstimate | null {
  const validCycles = cycles.filter(
    ({ distanceKm, fuelUsedLiters, kmPerLiter }) =>
      distanceKm > 0 &&
      fuelUsedLiters > 0 &&
      kmPerLiter > 0 &&
      Number.isFinite(kmPerLiter),
  )

  if (validCycles.length === 0) {
    return null
  }

  const recentValues = validCycles
    .slice(-5)
    .map(({ kmPerLiter }) => kmPerLiter)
    .sort((left, right) => left - right)
  const middle = Math.floor(recentValues.length / 2)
  const kmPerLiter =
    recentValues.length % 2 === 0
      ? (recentValues[middle - 1] + recentValues[middle]) / 2
      : recentValues[middle]

  let calibrationState: CalibrationState = 'estimated'

  if (validCycles.length >= 3) {
    const latestThree = validCycles
      .slice(-3)
      .map((cycle) => cycle.kmPerLiter)
      .sort((left, right) => left - right)
    const median = latestThree[1]
    const relativeSpread =
      (latestThree[2] - latestThree[0]) / median

    if (relativeSpread <= 0.2) {
      calibrationState = 'calibrated'
    }
  }

  return {
    kmPerLiter,
    calibrationState,
    cycleCount: validCycles.length,
  }
}
