import {
  buildConsumptionCycles,
  learnConsumption,
  type CalibrationState,
} from './domain/consumption'
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
  const cycles = buildConsumptionCycles(
    {
      odometerKm: state.initialOdometerKm,
      at: state.initialFullTankAt,
    },
    fuelEntries,
  )
  const consumption = learnConsumption(cycles)

  if (!consumption) {
    return {
      odometerKm,
      monthSpendCents,
      consumptionKmPerLiter: null,
      calibrationState: 'calibrating',
      fuelPercent: null,
      rangeKm: null,
    }
  }

  const fuelEstimate = estimateFuelRemaining({
    tankCapacityLiters: state.tankCapacityLiters,
    consumptionKmPerLiter: consumption.kmPerLiter,
    initialAnchor: {
      odometerKm: state.initialOdometerKm,
      at: state.initialFullTankAt,
    },
    fuelEntries,
    currentOdometerKm: odometerKm,
  })

  return {
    odometerKm,
    monthSpendCents,
    consumptionKmPerLiter: consumption.kmPerLiter,
    calibrationState: consumption.calibrationState,
    fuelPercent: fuelEstimate?.fuelPercent ?? null,
    rangeKm: fuelEstimate?.rangeKm ?? null,
  }
}
