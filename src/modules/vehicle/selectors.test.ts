import { describe, expect, it } from 'vitest'

import type {
  FuelEntry,
  OdometerReading,
  VehicleState,
} from './domain/types'
import { getVehicleDashboard } from './selectors'

const state: VehicleState = {
  nominalTankCapacityLiters: 3,
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
    estimatedLiters: liters,
    referencePricePerLiter: null,
    referenceWeekStart: null,
    referenceWeekEnd: null,
    fullTank,
    fueledAt,
    createdAt: fueledAt,
    updatedAt: fueledAt,
  }
}

describe('getVehicleDashboard', () => {
  it('uses recorded fuel mileage when the latest reading precedes a full tank', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('later-reading', 1_050, '2026-09-29T10:00:00.000Z')],
      [fuel('full', 1_100, 3, true, '2026-09-28T10:00:00.000Z')],
      now,
    )

    expect(dashboard.odometerKm).toBe(1_100)
    expect(dashboard.fuelPercent).toBe(100)
    expect(dashboard.rangeState).toBe('ready')
  })

  it('includes mileage from partial fuel entries without changing the records', () => {
    const entries = [
      fuel('full', 1_100, 3, true, '2026-09-28T10:00:00.000Z'),
      fuel('partial', 1_120, 0.5, false, '2026-09-29T10:00:00.000Z'),
    ]
    const original = structuredClone(entries)
    const dashboard = getVehicleDashboard(state, [], entries, now)

    expect(dashboard.odometerKm).toBe(1_120)
    expect(dashboard.remainingLiters).toBeCloseTo(2.9)
    expect(entries).toEqual(original)
  })

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

    expect(dashboard.rangeKm).toBe(72)
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

    expect(dashboard.rangeKm).toBe(90)
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
    expect(dashboard.rangeKm).toBe(72)
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


describe('vehicle model v2 dashboard states', () => {
  it('waits for a full-tank anchor when setup started without one', () => {
    const noAnchorState = {
      ...state,
      initialFullTankAt: null,
    } as unknown as VehicleState

    expect(getVehicleDashboard(noAnchorState, [], [], now)).toMatchObject({
      rangeState: 'awaiting_full_tank',
      rangeKm: null,
      fuelPercent: null,
    })
  })

  it('applies the range safety factor only to displayed range', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_160, '2026-09-20T10:00:00.000Z')],
      [fuel('full', 1_120, 3, true, '2026-09-10T10:00:00.000Z')],
      now,
    )

    expect(dashboard.rangeState).toBe('ready')
    expect(dashboard.rangeKm).toBe(72)
    expect(dashboard.fuelPercent).toBeCloseTo(200 / 3)
    expect(dashboard.consumptionKmPerLiter).toBe(40)
  })
})


describe('dashboard operational metrics', () => {
  it('exposes remaining liters without applying the range safety factor', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_160, '2026-09-20T10:00:00.000Z')],
      [fuel('full', 1_120, 3, true, '2026-09-10T10:00:00.000Z')],
      now,
    )

    expect(dashboard.remainingLiters).toBeCloseTo(2)
    expect(dashboard.rangeKm).toBe(72)
  })

  it('reports monthly refuel count and average spend', () => {
    const dashboard = getVehicleDashboard(
      state,
      [],
      [
        fuel('one', 1_010, 1, false, '2026-09-01T12:00:00', 2_000),
        fuel('two', 1_020, 1, false, '2026-09-20T12:00:00', 3_000),
      ],
      now,
    )

    expect(dashboard.monthFuelEntryCount).toBe(2)
    expect(dashboard.monthAverageRefuelCents).toBe(2_500)
  })

  it('reports complete distance when a month-start baseline exists', () => {
    const dashboard = getVehicleDashboard(
      state,
      [
        reading('baseline', 1_000, '2026-08-31T23:00:00'),
        reading('current', 1_240, '2026-09-20T10:00:00'),
      ],
      [],
      now,
    )

    expect(dashboard.monthDistanceKm).toBe(240)
    expect(dashboard.monthDistanceState).toBe('complete')
  })

  it('reports partial distance when the vehicle was first configured this month', () => {
    const recentState = {
      ...state,
      initialOdometerKm: 5_000,
      createdAt: '2026-09-05T10:00:00',
    }
    const dashboard = getVehicleDashboard(
      recentState,
      [reading('current', 5_120, '2026-09-20T10:00:00')],
      [],
      now,
    )

    expect(dashboard.monthDistanceKm).toBe(120)
    expect(dashboard.monthDistanceState).toBe('partial')
  })

  it('does not invent monthly distance without a usable baseline', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_240, '2026-09-20T10:00:00')],
      [],
      now,
    )

    expect(dashboard.monthDistanceKm).toBeNull()
    expect(dashboard.monthDistanceState).toBe('unavailable')
  })

  it('derives autonomy in days from at least seven days of recent odometer pace', () => {
    const dashboard = getVehicleDashboard(
      state,
      [
        reading('pace-start', 1_060, '2026-09-10T10:00:00'),
        reading('current', 1_160, '2026-09-20T10:00:00'),
      ],
      [fuel('full', 1_120, 3, true, '2026-09-15T10:00:00')],
      now,
    )

    expect(dashboard.recentDailyDistanceKm).toBeCloseTo(10)
    expect(dashboard.rangeDays).toBeCloseTo(7.2)
  })
})


describe('initial full-tank calibration state', () => {
  it('shows the physical full tank immediately before the first cycle', () => {
    const freshState = {
      ...state,
      initialOdometerKm: 12_483,
      initialFullTankAt: '2026-09-30T18:00:00.000Z',
      createdAt: '2026-09-30T18:00:00.000Z',
      updatedAt: '2026-09-30T18:00:00.000Z',
    }

    const dashboard = getVehicleDashboard(
      freshState,
      [reading('initial', 12_483, '2026-09-30T18:00:00.000Z')],
      [],
      new Date('2026-09-30T18:05:00.000Z'),
    )

    expect(dashboard.remainingLiters).toBe(3)
    expect(dashboard.fuelPercent).toBe(100)
    expect(dashboard.rangeKm).toBeNull()
    expect(dashboard.calibrationCycleCount).toBe(0)
    expect(dashboard.rangeState).toBe('calibrating')
  })

  it('exposes completed calibration cycles as they accumulate', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_240, '2026-09-20T10:00:00.000Z')],
      [
        fuel('full-1', 1_120, 3, true, '2026-07-01T10:00:00.000Z'),
        fuel('full-2', 1_240, 3, true, '2026-08-01T10:00:00.000Z'),
      ],
      now,
    )

    expect(dashboard.calibrationCycleCount).toBe(2)
  })
})
