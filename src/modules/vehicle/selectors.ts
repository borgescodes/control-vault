import {
  buildConsumptionCycles,
  learnConsumption,
  type CalibrationState,
  type FullTankAnchor,
} from './domain/consumption'
import { RANGE_SAFETY_FACTOR } from './domain/config'
import { estimateFuelRemaining } from './domain/fuelEstimate'
import type {
  FuelEntry,
  OdometerReading,
  VehicleState,
} from './domain/types'

export type VehicleDashboard = {
  odometerKm: number
  monthSpendCents: number
  consumptionKmPerLiter: number | null
  calibrationState: CalibrationState
  fuelPercent: number | null
  rangeKm: number | null
  rangeState: 'awaiting_full_tank' | 'calibrating' | 'ready'
}

export function getVehicleDashboard(
  state: VehicleState,
  readings: OdometerReading[],
  fuelEntries: FuelEntry[],
  now: Date,
): VehicleDashboard {
  const latestReading = readings.reduce<OdometerReading | null>(
    (latest, reading) => {
      if (
        !latest ||
        reading.recordedAt > latest.recordedAt ||
        (reading.recordedAt === latest.recordedAt &&
          reading.readingKm > latest.readingKm)
      ) {
        return reading
      }

      return latest
    },
    null,
  )
  const odometerKm = latestReading?.readingKm ?? state.initialOdometerKm
  const monthSpendCents = fuelEntries.reduce((total, entry) => {
    const fueledAt = new Date(entry.fueledAt)

    if (
      fueledAt.getFullYear() === now.getFullYear() &&
      fueledAt.getMonth() === now.getMonth()
    ) {
      return total + entry.amountCents
    }

    return total
  }, 0)
  const initialAnchor: FullTankAnchor | null = state.initialFullTankAt
    ? {
        odometerKm: state.initialOdometerKm,
        at: state.initialFullTankAt,
      }
    : null
  const hasFullAnchor =
    initialAnchor !== null || fuelEntries.some((entry) => entry.fullTank)
  const cycles = buildConsumptionCycles(initialAnchor, fuelEntries)
  const consumption = learnConsumption(cycles)

  if (!consumption) {
    return {
      odometerKm,
      monthSpendCents,
      consumptionKmPerLiter: null,
      calibrationState: 'calibrating',
      fuelPercent: null,
      rangeKm: null,
      rangeState: hasFullAnchor ? 'calibrating' : 'awaiting_full_tank',
    }
  }

  const fuelEstimate = estimateFuelRemaining({
    nominalTankCapacityLiters: state.nominalTankCapacityLiters,
    consumptionKmPerLiter: consumption.kmPerLiter,
    initialAnchor,
    fuelEntries,
    currentOdometerKm: odometerKm,
  })

  return {
    odometerKm,
    monthSpendCents,
    consumptionKmPerLiter: consumption.kmPerLiter,
    calibrationState: consumption.calibrationState,
    fuelPercent: fuelEstimate?.fuelPercent ?? null,
    rangeKm:
      fuelEstimate === null
        ? null
        : fuelEstimate.rangeKm * RANGE_SAFETY_FACTOR,
    rangeState: fuelEstimate ? 'ready' : 'calibrating',
  }
}
