import { describe, expect, it } from 'vitest'

import type {
  FuelEntry,
  OdometerReading,
  VehicleState,
} from './domain/types'
import { getVehicleDashboard } from './selectors'

const state: VehicleState = {
  tankCapacityLiters: 3,
  initialOdometerKm: 1_000,
  initialFullTankAt: '2026-06-01T10:00:00.000Z',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
}

const now = new Date(2026, 8, 29, 12)

function reading(
  id: string,
  readingKm: number,
  recordedAt: string,
): OdometerReading {
  return {
    id,
    readingKm,
    recordedAt,
    source: 'manual',
    createdAt: recordedAt,
    updatedAt: recordedAt,
  }
}

function fuel(
  id: string,
  odometerKm: number,
  liters: number,
  fullTank: boolean,
  fueledAt: string,
  amountCents = 1_000,
): FuelEntry {
  return {
    id,
    odometerKm,
    amountCents,
    liters,
    fullTank,
    fueledAt,
    createdAt: fueledAt,
    updatedAt: fueledAt,
  }
}

describe('getVehicleDashboard', () => {
  it('uses the latest reading and the higher odometer on a time tie', () => {
    const dashboard = getVehicleDashboard(
      state,
      [
        reading('latest-low', 1_200, '2026-09-20T10:00:00.000Z'),
        reading('older', 9_000, '2026-09-19T10:00:00.000Z'),
        reading('latest-high', 1_250, '2026-09-20T10:00:00.000Z'),
      ],
      [],
      now,
    )

    expect(dashboard.odometerKm).toBe(1_250)
  })

  it('does not mutate odometer readings', () => {
    const readings = [
      reading('later', 1_200, '2026-09-20T10:00:00.000Z'),
      reading('earlier', 1_100, '2026-09-10T10:00:00.000Z'),
    ]
    const originalOrder = readings.map(({ id }) => id)

    getVehicleDashboard(state, readings, [], now)

    expect(readings.map(({ id }) => id)).toEqual(originalOrder)
  })

  it('sums spending from the same local month and year', () => {
    const dashboard = getVehicleDashboard(
      state,
      [],
      [
        fuel('september-1', 1_010, 1, false, '2026-09-01T12:00:00', 2_590),
        fuel('september-2', 1_020, 1, false, '2026-09-28T12:00:00', 3_410),
      ],
      now,
    )

    expect(dashboard.monthSpendCents).toBe(6_000)
  })

  it('does not include an entry from the previous month', () => {
    const dashboard = getVehicleDashboard(
      state,
      [],
      [
        fuel('august', 1_010, 1, false, '2026-08-31T12:00:00', 9_000),
        fuel('september', 1_020, 1, false, '2026-09-01T12:00:00', 1_000),
      ],
      now,
    )

    expect(dashboard.monthSpendCents).toBe(1_000)
  })

  it('does not include the same month from another year', () => {
    const dashboard = getVehicleDashboard(
      state,
      [],
      [
        fuel('last-year', 1_010, 1, false, '2025-09-15T12:00:00', 9_000),
        fuel('this-year', 1_020, 1, false, '2026-09-15T12:00:00', 1_000),
      ],
      now,
    )

    expect(dashboard.monthSpendCents).toBe(1_000)
  })

  it('reports calibrating with no consumption or range before a complete cycle', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_040, '2026-09-20T10:00:00.000Z')],
      [fuel('partial', 1_020, 0.5, false, '2026-09-10T10:00:00.000Z')],
      now,
    )

    expect(dashboard).toMatchObject({
      consumptionKmPerLiter: null,
      calibrationState: 'calibrating',
      fuelPercent: null,
      rangeKm: null,
    })
  })

  it('reports estimated consumption after one complete cycle', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_120, '2026-09-20T10:00:00.000Z')],
      [fuel('full', 1_120, 3, true, '2026-09-20T10:00:00.000Z')],
      now,
    )

    expect(dashboard.consumptionKmPerLiter).toBe(40)
    expect(dashboard.calibrationState).toBe('estimated')
  })

  it('reports calibrated after three stable cycles', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_360, '2026-09-20T10:00:00.000Z')],
      [
        fuel('full-1', 1_120, 3, true, '2026-07-01T10:00:00.000Z'),
        fuel('full-2', 1_240, 3, true, '2026-08-01T10:00:00.000Z'),
        fuel('full-3', 1_360, 3, true, '2026-09-01T10:00:00.000Z'),
      ],
      now,
    )

    expect(dashboard.calibrationState).toBe('calibrated')
    expect(dashboard.consumptionKmPerLiter).toBe(40)
  })

  it('uses the fuel engine for estimated range', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_160, '2026-09-20T10:00:00.000Z')],
      [fuel('full', 1_120, 3, true, '2026-09-10T10:00:00.000Z')],
      now,
    )

    expect(dashboard.rangeKm).toBe(80)
    expect(dashboard.fuelPercent).toBeCloseTo(200 / 3)
  })

  it('includes a partial fill after the latest anchor in range', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_160, '2026-09-20T10:00:00.000Z')],
      [
        fuel('full', 1_120, 3, true, '2026-09-10T10:00:00.000Z'),
        fuel('partial', 1_140, 0.5, false, '2026-09-15T10:00:00.000Z'),
      ],
      now,
    )

    expect(dashboard.rangeKm).toBe(100)
    expect(dashboard.fuelPercent).toBeCloseTo(250 / 3)
  })

  it('resets the estimate at the latest full tank', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_240, '2026-09-20T10:00:00.000Z')],
      [
        fuel('partial-before', 1_060, 1, false, '2026-07-01T10:00:00.000Z'),
        fuel('full-1', 1_120, 2, true, '2026-08-01T10:00:00.000Z'),
        fuel('full-2', 1_200, 2, true, '2026-09-01T10:00:00.000Z'),
      ],
      now,
    )

    expect(dashboard.consumptionKmPerLiter).toBe(40)
    expect(dashboard.rangeKm).toBe(80)
  })

  it('does not mutate fuel entries', () => {
    const fuelEntries = [
      fuel('later', 1_120, 3, true, '2026-09-20T10:00:00.000Z'),
      fuel('earlier', 1_060, 1, false, '2026-09-10T10:00:00.000Z'),
    ]
    const originalOrder = fuelEntries.map(({ id }) => id)

    getVehicleDashboard(
      state,
      [reading('current', 1_120, '2026-09-20T10:00:00.000Z')],
      fuelEntries,
      now,
    )

    expect(fuelEntries.map(({ id }) => id)).toEqual(originalOrder)
  })
})
