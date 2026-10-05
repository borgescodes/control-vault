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
    deletedAt: null,
    createdAt: fueledAt,
    updatedAt: fueledAt,
  }
}

describe('getVehicleDashboard', () => {
  it('does not resurrect a pre-setup full tank through a later duplicate', () => {
    const currentState = {
      ...state, initialOdometerKm: 1_000, initialFullTankAt: null,
      createdAt: '2026-09-20T10:00:00Z',
    }
    const original = fuel('original', 1_100, 3, true, '2026-09-19T10:00:00Z', 2_005)
    const copy = { ...original, id: 'copy', fueledAt: '2026-09-21T10:00:00Z' }
    const dashboard = getVehicleDashboard(currentState, [], [copy, original], now)
    expect(dashboard.odometerKm).toBe(1_000)
    expect(dashboard.rangeState).toBe('awaiting_full_tank')
    expect(dashboard.fuelPercent).toBeNull()
    expect(dashboard.monthSpendCents).toBe(2_005)
  })

  it('counts identical full-tank records once, retaining the earliest event date', () => {
    const entries = [
      fuel('later-copy', 1_100, 3, true, '2026-09-21T10:00:00Z', 2_005),
      fuel('original', 1_100, 3, true, '2026-09-20T10:00:00Z', 2_005),
    ]
    const dashboard = getVehicleDashboard(state, [], entries, now)
    expect(dashboard.monthSpendCents).toBe(2_005)
    expect(dashboard.monthFuelEntryCount).toBe(1)
    expect(entries).toHaveLength(2)
  })

  it('keeps pre-setup fuel history out of the current estimates and odometer', () => {
    const currentState: VehicleState = {
      ...state,
      initialOdometerKm: 12_483,
      initialFullTankAt: '2026-09-30T18:52:20.437Z',
      createdAt: '2026-09-30T18:52:20.437Z',
    }
    const entries = [
      { ...fuel('legacy-unknown', 125_727, 1, true, '2026-09-29T17:46:15.869Z', 3_000), estimatedLiters: null },
      fuel('legacy-large', 1_264_727, 2.837, true, '2026-09-29T17:47:37.934Z', 2_000),
      fuel('full', 12_587.4, 2.843, true, '2026-10-01T02:51:58.174Z', 2_005),
      fuel('full-same-km', 12_587.4, 2.843, true, '2026-10-01T14:45:20.489Z', 2_005),
    ]
    const original = structuredClone(entries)
    const readings = [reading('current', 12_612.8, '2026-10-01T16:26:00.000Z')]
    const dashboard = getVehicleDashboard(currentState, readings, entries, new Date('2026-10-01T20:00:00Z'))

    expect(dashboard.odometerKm).toBe(12_612.8)
    expect(dashboard.consumptionKmPerLiter).toBeCloseTo(36.7218, 4)
    expect(dashboard.rangeKm).toBeCloseTo(76.2888, 3)
    expect(dashboard.calibrationCycleCount).toBe(1)
    expect(dashboard.fuelPercent).toBeCloseTo(76.9437, 3)
    expect(entries).toEqual(original)
    const september = getVehicleDashboard(currentState, readings, entries, new Date('2026-09-30T20:00:00Z'))
    // The first current full tank is Sep 30 in Brazil, Oct 1 in UTC.
    const currentSeptemberSpend = new Date(entries[2].fueledAt).getMonth() === 8 ? 2_005 : 0
    expect(september.monthSpendCents).toBe(5_000 + currentSeptemberSpend)
  })

  it('ignores legacy fuel-generated odometer readings', () => {
    const legacyFuelReading: OdometerReading = {
      ...reading('legacy-fuel-reading', 9_999, '2026-09-29T11:00:00.000Z'),
      source: 'fuel_entry',
    }

    const dashboard = getVehicleDashboard(state, [legacyFuelReading], [], now)

    expect(dashboard.odometerKm).toBe(state.initialOdometerKm)
  })

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


describe('derived operating analytics', () => {
  const analyticsNow = new Date('2026-09-29T12:00:00.000Z')

  it('derives recent and previous 30-day spend and observed distance', () => {
    const dashboard = getVehicleDashboard(
      state,
      [
        reading('previous-start', 1_000, '2026-08-01T12:00:00.000Z'),
        reading('previous-end', 1_200, '2026-08-29T12:00:00.000Z'),
        reading('recent-start', 1_200, '2026-09-01T12:00:00.000Z'),
        reading('recent-end', 1_400, '2026-09-29T12:00:00.000Z'),
      ],
      [
        fuel('previous-one', 1_050, 1, false, '2026-08-05T12:00:00.000Z', 2_000),
        fuel('previous-two', 1_150, 1, false, '2026-08-20T12:00:00.000Z', 2_000),
        fuel('recent-one', 1_250, 1, false, '2026-09-05T12:00:00.000Z', 3_000),
        fuel('recent-two', 1_350, 1, false, '2026-09-20T12:00:00.000Z', 2_000),
      ],
      analyticsNow,
    )

    expect(dashboard.recent30SpendCents).toBe(5_000)
    expect(dashboard.recent30DistanceKm).toBe(200)
    expect(dashboard.recent30CostPerKmCents).toBe(25)
    expect(dashboard.previous30SpendChangePercent).toBe(25)
    expect(dashboard.previous30DistanceChangePercent).toBe(0)
  })

  it('does not extrapolate distance from insufficient coverage', () => {
    const dashboard = getVehicleDashboard(
      state,
      [],
      [fuel('recent', 1_350, 1, false, '2026-09-20T12:00:00.000Z', 5_000)],
      analyticsNow,
    )

    expect(dashboard.recent30SpendCents).toBe(5_000)
    expect(dashboard.recent30DistanceKm).toBeNull()
    expect(dashboard.recent30CostPerKmCents).toBeNull()
  })

  it('omits percentage comparisons when the previous denominator is zero', () => {
    const dashboard = getVehicleDashboard(
      state,
      [
        reading('recent-start', 1_200, '2026-09-01T12:00:00.000Z'),
        reading('recent-end', 1_400, '2026-09-29T12:00:00.000Z'),
      ],
      [fuel('recent', 1_300, 1, false, '2026-09-20T12:00:00.000Z', 5_000)],
      analyticsNow,
    )

    expect(dashboard.previous30SpendChangePercent).toBeNull()
    expect(dashboard.previous30DistanceChangePercent).toBeNull()
  })

  it('excludes tombstones from recent spend', () => {
    const deleted = {
      ...fuel('deleted', 1_300, 1, false, '2026-09-20T12:00:00.000Z', 9_000),
      deletedAt: '2026-09-21T12:00:00.000Z',
    }
    const dashboard = getVehicleDashboard(
      state,
      [],
      [
        fuel('active', 1_350, 1, false, '2026-09-22T12:00:00.000Z', 2_000),
        deleted,
      ],
      analyticsNow,
    )

    expect(dashboard.recent30SpendCents).toBe(2_000)
  })

  it('exposes cycle cost, cost per km and km/L variation', () => {
    const dashboard = getVehicleDashboard(
      state,
      [reading('current', 1_240, '2026-09-20T12:00:00.000Z')],
      [
        fuel('full-one', 1_120, 3, true, '2026-08-01T12:00:00.000Z', 2_100),
        fuel('full-two', 1_240, 2.5, true, '2026-09-01T12:00:00.000Z', 1_750),
      ],
      analyticsNow,
    )

    expect(dashboard.consumptionCycles).toHaveLength(2)
    expect(dashboard.consumptionCycles[0]).toMatchObject({
      distanceKm: 120,
      fuelUsedLiters: 3,
      fuelCostCents: 2_100,
      costPerKmCents: 17.5,
      kmPerLiterChangePercent: null,
    })
    expect(dashboard.consumptionCycles[1].costPerKmCents).toBeCloseTo(14.5833, 4)
    expect(dashboard.consumptionCycles[1].kmPerLiterChangePercent).toBeCloseTo(20)
  })

  it('recomputes cycle and spend metrics immediately after an edit or tombstone', () => {
    const original = fuel(
      'full',
      1_120,
      3,
      true,
      '2026-09-20T12:00:00.000Z',
      2_100,
    )
    const edited = {
      ...original,
      amountCents: 3_000,
      estimatedLiters: 2.5,
      updatedAt: '2026-09-25T12:00:00.000Z',
    }
    const deleted = {
      ...edited,
      deletedAt: '2026-09-26T12:00:00.000Z',
      updatedAt: '2026-09-26T12:00:00.000Z',
    }

    const before = getVehicleDashboard(
      state,
      [reading('current', 1_120, '2026-09-20T12:00:00.000Z')],
      [original],
      analyticsNow,
    )
    const afterEdit = getVehicleDashboard(
      state,
      [reading('current', 1_120, '2026-09-20T12:00:00.000Z')],
      [edited],
      analyticsNow,
    )
    const afterDelete = getVehicleDashboard(
      state,
      [reading('current', 1_120, '2026-09-20T12:00:00.000Z')],
      [deleted],
      analyticsNow,
    )

    expect(before.consumptionCycles[0].fuelCostCents).toBe(2_100)
    expect(afterEdit.consumptionCycles[0]).toMatchObject({
      fuelCostCents: 3_000,
      fuelUsedLiters: 2.5,
    })
    expect(afterEdit.recent30SpendCents).toBe(3_000)
    expect(afterDelete.consumptionCycles).toEqual([])
    expect(afterDelete.recent30SpendCents).toBe(0)
  })

  it('derives qualitative confidence and downgrades stale cycle evidence once', () => {
    const recent = getVehicleDashboard(
      state,
      [reading('current', 1_360, '2026-09-20T10:00:00.000Z')],
      [
        fuel('full-1', 1_120, 3, true, '2026-07-01T10:00:00.000Z'),
        fuel('full-2', 1_240, 3, true, '2026-08-01T10:00:00.000Z'),
        fuel('full-3', 1_360, 3, true, '2026-09-01T10:00:00.000Z'),
      ],
      analyticsNow,
    )
    const stale = getVehicleDashboard(
      {
        ...state,
        createdAt: '2025-01-01T10:00:00.000Z',
        initialFullTankAt: '2025-01-01T10:00:00.000Z',
      },
      [reading('current', 1_360, '2026-09-20T10:00:00.000Z')],
      [
        fuel('full-1', 1_120, 3, true, '2025-02-01T10:00:00.000Z'),
        fuel('full-2', 1_240, 3, true, '2025-03-01T10:00:00.000Z'),
        fuel('full-3', 1_360, 3, true, '2025-04-01T10:00:00.000Z'),
      ],
      analyticsNow,
    )

    expect(recent.rangeConfidence).toBe('high')
    expect(stale.rangeConfidence).toBe('medium')
  })
})
