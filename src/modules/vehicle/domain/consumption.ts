import type { FuelEntry } from './types'

export type FullTankAnchor = {
  odometerKm: number
  at: string
}

export type ConsumptionCycle = {
  startKm: number
  endKm: number
  startAt: string
  endAt: string
  distanceKm: number
  fuelUsedLiters: number
  fuelCostCents: number
  kmPerLiter: number
}

export type CalibrationState = 'calibrating' | 'estimated' | 'calibrated'
export type RangeConfidence = 'low' | 'medium' | 'high'

export type ConsumptionEstimate = {
  kmPerLiter: number
  calibrationState: CalibrationState
  cycleCount: number
}

export function buildConsumptionCycles(
  initialAnchor: FullTankAnchor | null,
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
  let fuelCostCents = 0
  let hasKnownFuel = true

  for (const entry of entries) {
    if (!anchor) {
      if (entry.fullTank) {
        anchor = { odometerKm: entry.odometerKm, at: entry.fueledAt }
      }
      continue
    }

    if (
      entry.odometerKm < anchor.odometerKm ||
      (entry.odometerKm === anchor.odometerKm && entry.fueledAt <= anchor.at)
    ) {
      continue
    }

    fuelCostCents += entry.amountCents
    if (entry.estimatedLiters === null) {
      hasKnownFuel = false
    } else {
      fuelUsedLiters += entry.estimatedLiters
    }

    if (!entry.fullTank) {
      continue
    }

    const distanceKm = entry.odometerKm - anchor.odometerKm
    const kmPerLiter = distanceKm / fuelUsedLiters

    if (
      hasKnownFuel &&
      distanceKm > 0 &&
      fuelUsedLiters > 0 &&
      Number.isFinite(kmPerLiter)
    ) {
      cycles.push({
        startKm: anchor.odometerKm,
        endKm: entry.odometerKm,
        startAt: anchor.at,
        endAt: entry.fueledAt,
        distanceKm,
        fuelUsedLiters,
        fuelCostCents,
        kmPerLiter,
      })
    }

    anchor = { odometerKm: entry.odometerKm, at: entry.fueledAt }
    fuelUsedLiters = 0
    fuelCostCents = 0
    hasKnownFuel = true
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


const CONFIDENCE_RECENCY_MS = 90 * 86_400_000

export function deriveRangeConfidence(
  calibrationState: CalibrationState,
  cycles: ConsumptionCycle[],
  now: Date,
): RangeConfidence {
  const base: RangeConfidence =
    calibrationState === 'calibrated'
      ? 'high'
      : calibrationState === 'estimated'
        ? 'medium'
        : 'low'

  const latestCycleAt = cycles.reduce<number | null>((latest, cycle) => {
    const at = new Date(cycle.endAt).getTime()
    if (!Number.isFinite(at)) return latest
    return latest === null ? at : Math.max(latest, at)
  }, null)

  if (
    latestCycleAt === null ||
    now.getTime() - latestCycleAt <= CONFIDENCE_RECENCY_MS
  ) {
    return base
  }

  return base === 'high' ? 'medium' : 'low'
}
