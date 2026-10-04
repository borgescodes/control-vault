import {
  buildConsumptionCycles,
  learnConsumption,
  type CalibrationState,
  type FullTankAnchor,
} from './domain/consumption'
import { RANGE_SAFETY_FACTOR } from './domain/config'
import { estimateFuelRemaining } from './domain/fuelEstimate'
import {
  getLatestOdometerKm,
  getOdometerTimeline,
} from './domain/odometer'
import { uniqueFuelEntries } from './fuelEntries'
import type {
  FuelEntry,
  OdometerReading,
  VehicleState,
} from './domain/types'

const DAY_MS = 86_400_000

export type MonthDistanceState = 'complete' | 'partial' | 'unavailable'

export type VehicleDashboard = {
  odometerKm: number
  monthSpendCents: number
  monthFuelEntryCount: number
  monthAverageRefuelCents: number | null
  monthDistanceKm: number | null
  monthDistanceState: MonthDistanceState
  consumptionKmPerLiter: number | null
  calibrationState: CalibrationState
  calibrationCycleCount: number
  remainingLiters: number | null
  fuelPercent: number | null
  rangeKm: number | null
  recentDailyDistanceKm: number | null
  rangeDays: number | null
  rangeState: 'awaiting_full_tank' | 'calibrating' | 'ready'
}

function timestamp(value: string): number {
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : Number.NaN
}

export function getVehicleDashboard(
  state: VehicleState,
  readings: OdometerReading[],
  fuelEntries: FuelEntry[],
  now: Date,
): VehicleDashboard {
  // Historical entries survive setup changes and synchronization. Only the
  // current setup's fuel ledger may contribute to operational estimates.
  const canonicalFuelEntries = uniqueFuelEntries(fuelEntries)
  const operationalFuelEntries = canonicalFuelEntries.filter(
    (entry) => timestamp(entry.fueledAt) >= timestamp(state.createdAt),
  )
  const createdAt = timestamp(state.createdAt)
  const operationalReadings = readings.filter(
    (reading) =>
      reading.source === 'manual' &&
      timestamp(reading.recordedAt) >= createdAt,
  )
  const operationalTimeline = getOdometerTimeline(
    operationalReadings,
    operationalFuelEntries,
  )
  const odometerKm =
    getLatestOdometerKm(
      operationalReadings,
      operationalFuelEntries,
      state.initialOdometerKm,
    ) ?? state.initialOdometerKm

  const monthEntries = canonicalFuelEntries.filter((entry) => {
    const fueledAt = new Date(entry.fueledAt)
    return (
      fueledAt.getFullYear() === now.getFullYear() &&
      fueledAt.getMonth() === now.getMonth()
    )
  })
  const monthSpendCents = monthEntries.reduce(
    (total, entry) => total + entry.amountCents,
    0,
  )
  const monthFuelEntryCount = monthEntries.length
  const monthAverageRefuelCents =
    monthFuelEntryCount === 0
      ? null
      : Math.round(monthSpendCents / monthFuelEntryCount)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const nowTime = now.getTime()
  const monthBaseline = operationalTimeline.reduce<
    (typeof operationalTimeline)[number] | null
  >((latest, event) => {
    const at = timestamp(event.at)
    if (!Number.isFinite(at) || at > monthStart) return latest
    if (!latest || at > timestamp(latest.at)) return event
    return latest
  }, null)

  let monthDistanceKm: number | null = null
  let monthDistanceState: MonthDistanceState = 'unavailable'

  if (monthBaseline) {
    monthDistanceKm = Math.max(0, odometerKm - monthBaseline.odometerKm)
    monthDistanceState = 'complete'
  } else {
    if (
      Number.isFinite(createdAt) &&
      createdAt >= monthStart &&
      createdAt <= nowTime
    ) {
      monthDistanceKm = Math.max(0, odometerKm - state.initialOdometerKm)
      monthDistanceState = 'partial'
    }
  }

  const cutoff = nowTime - 30 * DAY_MS
  const recentEvents = operationalTimeline
    .map((event) => ({ event, at: timestamp(event.at) }))
    .filter(
      ({ at }) => Number.isFinite(at) && at >= cutoff && at <= nowTime,
    )
    .sort((left, right) => left.at - right.at)

  let recentDailyDistanceKm: number | null = null
  if (recentEvents.length >= 2) {
    const first = recentEvents[0]
    const last = recentEvents[recentEvents.length - 1]
    const elapsedDays = (last.at - first.at) / DAY_MS
    const distanceKm = last.event.odometerKm - first.event.odometerKm

    if (elapsedDays >= 7 && distanceKm > 0) {
      recentDailyDistanceKm = distanceKm / elapsedDays
    }
  }

  const initialAnchor: FullTankAnchor | null = state.initialFullTankAt
    ? {
        odometerKm: state.initialOdometerKm,
        at: state.initialFullTankAt,
      }
    : null
  const fullAnchors = [
    ...(initialAnchor ? [initialAnchor] : []),
    ...operationalFuelEntries
      .filter((entry) => entry.fullTank)
      .map((entry) => ({ odometerKm: entry.odometerKm, at: entry.fueledAt })),
  ]
  const latestFullAnchor = fullAnchors.reduce<FullTankAnchor | null>(
    (latest, anchor) =>
      !latest ||
      anchor.odometerKm > latest.odometerKm ||
      (anchor.odometerKm === latest.odometerKm && anchor.at > latest.at)
        ? anchor
        : latest,
    null,
  )
  const hasFullAnchor = latestFullAnchor !== null
  const cycles = buildConsumptionCycles(initialAnchor, operationalFuelEntries)
  const consumption = learnConsumption(cycles)

  const shared = {
    odometerKm,
    monthSpendCents,
    monthFuelEntryCount,
    monthAverageRefuelCents,
    monthDistanceKm,
    monthDistanceState,
    recentDailyDistanceKm,
  }

  if (!consumption) {
    const knownFullNow =
      latestFullAnchor !== null &&
      latestFullAnchor.odometerKm === odometerKm

    return {
      ...shared,
      consumptionKmPerLiter: null,
      calibrationState: 'calibrating',
      calibrationCycleCount: cycles.length,
      remainingLiters: knownFullNow
        ? state.nominalTankCapacityLiters
        : null,
      fuelPercent: knownFullNow ? 100 : null,
      rangeKm: null,
      rangeDays: null,
      rangeState: hasFullAnchor ? 'calibrating' : 'awaiting_full_tank',
    }
  }

  const fuelEstimate = estimateFuelRemaining({
    nominalTankCapacityLiters: state.nominalTankCapacityLiters,
    consumptionKmPerLiter: consumption.kmPerLiter,
    initialAnchor,
    fuelEntries: operationalFuelEntries,
    currentOdometerKm: odometerKm,
  })
  const rangeKm =
    fuelEstimate === null
      ? null
      : fuelEstimate.rangeKm * RANGE_SAFETY_FACTOR

  return {
    ...shared,
    consumptionKmPerLiter: consumption.kmPerLiter,
    calibrationState: consumption.calibrationState,
    calibrationCycleCount: consumption.cycleCount,
    remainingLiters: fuelEstimate?.remainingLiters ?? null,
    fuelPercent: fuelEstimate?.fuelPercent ?? null,
    rangeKm,
    rangeDays:
      rangeKm !== null && recentDailyDistanceKm !== null
        ? rangeKm / recentDailyDistanceKm
        : null,
    rangeState: fuelEstimate ? 'ready' : 'calibrating',
  }
}
