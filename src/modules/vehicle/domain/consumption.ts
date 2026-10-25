import type { FuelEntry } from './types'

export function effectiveFuelLiters(entry: FuelEntry): number | null {
  return entry.liters ?? entry.estimatedLiters
}

export function latestMeasuredPricePerLiter(entries: FuelEntry[]): number | null {
  const latest = entries
    .filter((entry) => entry.deletedAt === null && entry.liters !== null && entry.liters !== undefined && entry.liters > 0)
    .sort((a, b) => b.fueledAt.localeCompare(a.fueledAt))[0]
  return latest?.liters ? (latest.amountCents / 100) / latest.liters : null
}

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
    const liters = effectiveFuelLiters(entry)
    if (liters === null) {
      hasKnownFuel = false
    } else {
      fuelUsedLiters += liters
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

/**
 * New calibration is isolated from ANP estimates. Every fill in a completed
 * full-to-full interval must have a real pump measurement.
 */
export function buildMeasuredConsumptionCycles(fuelEntries: FuelEntry[]): ConsumptionCycle[] {
  const entries = [...fuelEntries]
    .filter((entry) => entry.deletedAt === null)
    .sort((a, b) => a.fueledAt.localeCompare(b.fueledAt) || a.odometerKm - b.odometerKm)
  const cycles: ConsumptionCycle[] = []
  let start: FuelEntry | null = null
  let liters = 0
  let cents = 0
  let allMeasured = true
  for (const entry of entries) {
    const measured = entry.liters
    if (!start) {
      if (entry.fullTank && measured != null && measured > 0) start = entry
      continue
    }
    if (entry.odometerKm < start.odometerKm) {
      allMeasured = false
    }
    if (measured == null || measured <= 0) allMeasured = false
    else liters += measured
    cents += entry.amountCents
    if (!entry.fullTank) continue

    const distanceKm = entry.odometerKm - start.odometerKm
    if (allMeasured && distanceKm > 0 && liters > 0) {
      cycles.push({
        startKm: start.odometerKm, endKm: entry.odometerKm,
        startAt: start.fueledAt, endAt: entry.fueledAt,
        distanceKm, fuelUsedLiters: liters, fuelCostCents: cents,
        kmPerLiter: distanceKm / liters,
      })
    }
    start = measured != null && measured > 0 ? entry : null
    liters = 0
    cents = 0
    allMeasured = true
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
