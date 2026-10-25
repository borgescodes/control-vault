import { effectiveFuelLiters, type FullTankAnchor } from './consumption'
import type { FuelEntry, OdometerReading } from './types'

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
  odometerReadings?: OdometerReading[]
  currentOdometerKm: number
}

export function estimateFuelRemaining({
  nominalTankCapacityLiters: capacity,
  consumptionKmPerLiter: consumption,
  initialAnchor,
  fuelEntries,
  odometerReadings = [],
  currentOdometerKm,
}: FuelEstimateInput): FuelEstimate | null {
  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new RangeError('Tank capacity must be greater than zero')
  }
  if (consumption === null) return null
  if (!Number.isFinite(consumption) || consumption <= 0) {
    throw new RangeError('Consumption must be greater than zero')
  }

  const anchors = [
    ...(initialAnchor ? [{
      km: initialAnchor.odometerKm, at: initialAnchor.at, quantity: capacity,
    }] : []),
    ...fuelEntries.filter((entry) => entry.deletedAt == null && entry.fullTank)
      .map((entry) => ({
        km: entry.odometerKm, at: entry.fueledAt, quantity: capacity,
      })),
    ...odometerReadings.filter((reading) => reading.source === 'manual' && reading.tankEmpty)
      .map((reading) => ({
        km: reading.readingKm, at: reading.recordedAt, quantity: 0,
      })),
  ].sort((a, b) => a.km - b.km || a.at.localeCompare(b.at))
  const anchor = anchors.at(-1)
  if (!anchor) return null
  if (!Number.isFinite(currentOdometerKm) || currentOdometerKm < anchor.km) {
    throw new RangeError('Current odometer cannot precede the latest anchor')
  }

  let remaining = anchor.quantity
  let previousKm = anchor.km
  const subsequent = fuelEntries
    .filter((entry) => entry.deletedAt == null && !entry.fullTank &&
      entry.odometerKm <= currentOdometerKm &&
      (entry.odometerKm > anchor.km ||
        (entry.odometerKm === anchor.km && entry.fueledAt > anchor.at)))
    .sort((a, b) => a.odometerKm - b.odometerKm || a.fueledAt.localeCompare(b.fueledAt))
  for (const entry of subsequent) {
    const liters = effectiveFuelLiters(entry)
    if (liters === null) return null
    remaining = Math.min(capacity, Math.max(0, remaining - (entry.odometerKm - previousKm) / consumption) + liters)
    previousKm = entry.odometerKm
  }
  remaining = Math.max(0, remaining - (currentOdometerKm - previousKm) / consumption)
  return {
    remainingLiters: remaining,
    rangeKm: remaining * consumption,
    fuelPercent: remaining / capacity * 100,
  }
}
