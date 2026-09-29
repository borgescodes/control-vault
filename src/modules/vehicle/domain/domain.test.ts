import { describe, expect, it } from 'vitest'

import { buildConsumptionCycles, learnConsumption } from './consumption'
import {
  SUSPICIOUS_ODOMETER_DELTA_KM,
  TANK_CAPACITY_LITERS,
} from './config'
import { estimateFuelRemaining } from './fuelEstimate'
import { validateOdometer } from './odometer'
import type {
  ConsumptionCycle,
  FullTankAnchor,
} from './consumption'
import type { FuelEntry } from './types'

const initialAnchor: FullTankAnchor = {
  odometerKm: 1_000,
  at: '2026-01-01T10:00:00.000Z',
}

function fuelEntry(
  id: string,
  odometerKm: number,
  liters: number,
  fullTank: boolean,
  fueledAt: string,
): FuelEntry {
  return {
    id,
    odometerKm,
    amountCents: 1_000,
    liters,
    fullTank,
    fueledAt,
    createdAt: fueledAt,
    updatedAt: fueledAt,
  }
}

function cycle(kmPerLiter: number): ConsumptionCycle {
  return {
    startKm: 0,
    endKm: kmPerLiter,
    distanceKm: kmPerLiter,
    fuelUsedLiters: 1,
    kmPerLiter,
  }
}

describe('vehicle domain configuration', () => {
  it('uses the approved tank capacity and suspicious delta', () => {
    expect(TANK_CAPACITY_LITERS).toBe(3)
    expect(SUSPICIOUS_ODOMETER_DELTA_KM).toBe(500)
  })
})

describe('validateOdometer', () => {
  it.each([
    [null, 100, 'valid', 0],
    [100, 99.9, 'invalid', -0.1],
    [100, 100, 'valid', 0],
    [100, 599.9, 'valid', 499.9],
    [100, 600, 'valid', 500],
    [100, 600.1, 'suspicious', 500.1],
  ] as const)(
    'classifies latest=%s and next=%s as %s',
    (latestKm, nextKm, kind, deltaKm) => {
      const result = validateOdometer(latestKm, nextKm)

      expect(result.kind).toBe(kind)
      expect(result.deltaKm).toBeCloseTo(deltaKm)
    },
  )
})

describe('buildConsumptionCycles', () => {
  it('includes partial fills and the closing full fill in one cycle', () => {
    const entries = [
      fuelEntry('partial-1', 1_040, 1, false, '2026-01-02T10:00:00.000Z'),
      fuelEntry('partial-2', 1_080, 0.5, false, '2026-01-03T10:00:00.000Z'),
      fuelEntry('full-1', 1_120, 1.5, true, '2026-01-04T10:00:00.000Z'),
    ]

    expect(buildConsumptionCycles(initialAnchor, entries)).toEqual([
      {
        startKm: 1_000,
        endKm: 1_120,
        distanceKm: 120,
        fuelUsedLiters: 3,
        kmPerLiter: 40,
      },
    ])
  })

  it('produces independent full-to-full cycles', () => {
    const entries = [
      fuelEntry('partial-1', 1_040, 1, false, '2026-01-02T10:00:00.000Z'),
      fuelEntry('full-1', 1_120, 2, true, '2026-01-03T10:00:00.000Z'),
      fuelEntry('partial-2', 1_160, 0.5, false, '2026-01-04T10:00:00.000Z'),
      fuelEntry('full-2', 1_200, 1.5, true, '2026-01-05T10:00:00.000Z'),
    ]

    expect(buildConsumptionCycles(initialAnchor, entries)).toEqual([
      {
        startKm: 1_000,
        endKm: 1_120,
        distanceKm: 120,
        fuelUsedLiters: 3,
        kmPerLiter: 40,
      },
      {
        startKm: 1_120,
        endKm: 1_200,
        distanceKm: 80,
        fuelUsedLiters: 2,
        kmPerLiter: 40,
      },
    ])
  })

  it('sorts by odometer and fueled time without mutating the input', () => {
    const entries = [
      fuelEntry('full', 1_120, 1.5, true, '2026-01-04T10:00:00.000Z'),
      fuelEntry('partial-late', 1_080, 0.5, false, '2026-01-03T12:00:00.000Z'),
      fuelEntry('partial-early', 1_080, 1, false, '2026-01-03T10:00:00.000Z'),
    ]
    const originalOrder = entries.map(({ id }) => id)

    const cycles = buildConsumptionCycles(initialAnchor, entries)

    expect(cycles[0].fuelUsedLiters).toBe(3)
    expect(entries.map(({ id }) => id)).toEqual(originalOrder)
  })

  it('ignores entries at or before the active anchor and incomplete tails', () => {
    const entries = [
      fuelEntry('old', 990, 10, false, '2025-12-31T10:00:00.000Z'),
      fuelEntry('equal', 1_000, 10, true, '2026-01-01T11:00:00.000Z'),
      fuelEntry('partial', 1_040, 1, false, '2026-01-02T10:00:00.000Z'),
    ]

    expect(buildConsumptionCycles(initialAnchor, entries)).toEqual([])
  })
})

describe('learnConsumption', () => {
  it('returns null without valid cycles', () => {
    expect(learnConsumption([])).toBeNull()
  })

  it('uses the median for an odd number of cycles', () => {
    expect(learnConsumption([cycle(38), cycle(42), cycle(40)])).toEqual({
      kmPerLiter: 40,
      calibrationState: 'calibrated',
      cycleCount: 3,
    })
  })

  it('uses the midpoint median for an even number of cycles', () => {
    expect(learnConsumption([cycle(30), cycle(50)])).toEqual({
      kmPerLiter: 40,
      calibrationState: 'estimated',
      cycleCount: 2,
    })
  })

  it('uses only the five most recent cycles for the median', () => {
    expect(
      learnConsumption([
        cycle(1_000),
        cycle(10),
        cycle(20),
        cycle(30),
        cycle(40),
        cycle(50),
      ]),
    ).toEqual({
      kmPerLiter: 30,
      calibrationState: 'estimated',
      cycleCount: 6,
    })
  })

  it('does not let an old outlier influence the recent window', () => {
    expect(
      learnConsumption([
        cycle(1_000),
        cycle(38),
        cycle(39),
        cycle(40),
        cycle(41),
        cycle(42),
      ])?.kmPerLiter,
    ).toBe(40)
  })

  it('calibrates when the three most recent cycles have spread 0.20', () => {
    expect(learnConsumption([cycle(36), cycle(40), cycle(44)]))
      .toMatchObject({ calibrationState: 'calibrated', cycleCount: 3 })
  })

  it('remains estimated when the three most recent cycles are unstable', () => {
    expect(learnConsumption([cycle(20), cycle(40), cycle(60)]))
      .toMatchObject({ calibrationState: 'estimated', cycleCount: 3 })
  })
})

describe('estimateFuelRemaining', () => {
  it('estimates remaining fuel, range and percentage from the anchor', () => {
    const estimate = estimateFuelRemaining({
      tankCapacityLiters: 3,
      consumptionKmPerLiter: 40,
      initialAnchor,
      fuelEntries: [],
      currentOdometerKm: 1_040,
    })

    expect(estimate?.remainingLiters).toBe(2)
    expect(estimate?.rangeKm).toBe(80)
    expect(estimate?.fuelPercent).toBeCloseTo(200 / 3)
  })

  it('adds partial fills after the anchor', () => {
    const estimate = estimateFuelRemaining({
      tankCapacityLiters: 3,
      consumptionKmPerLiter: 40,
      initialAnchor,
      fuelEntries: [
        fuelEntry('partial', 1_020, 0.5, false, '2026-01-02T10:00:00.000Z'),
      ],
      currentOdometerKm: 1_040,
    })

    expect(estimate?.remainingLiters).toBe(2.5)
  })

  it('clamps a partial refill before later consumption', () => {
    const estimate = estimateFuelRemaining({
      tankCapacityLiters: 3,
      consumptionKmPerLiter: 40,
      initialAnchor,
      fuelEntries: [
        fuelEntry('partial', 1_020, 5, false, '2026-01-02T10:00:00.000Z'),
      ],
      currentOdometerKm: 1_040,
    })

    expect(estimate?.remainingLiters).toBe(2.5)
    expect(estimate?.rangeKm).toBe(100)
    expect(estimate?.fuelPercent).toBeCloseTo(250 / 3)
  })

  it('clamps fuel at each partial refill before consuming later distance', () => {
    const estimate = estimateFuelRemaining({
      tankCapacityLiters: 3,
      consumptionKmPerLiter: 40,
      initialAnchor,
      fuelEntries: [
        fuelEntry('partial', 1_040, 3, false, '2026-01-02T10:00:00.000Z'),
      ],
      currentOdometerKm: 1_080,
    })

    expect(estimate?.remainingLiters).toBe(2)
    expect(estimate?.rangeKm).toBe(80)
    expect(estimate?.fuelPercent).toBeCloseTo(200 / 3)
  })

  it('clamps exhausted fuel to zero', () => {
    expect(
      estimateFuelRemaining({
        tankCapacityLiters: 3,
        consumptionKmPerLiter: 40,
        initialAnchor,
        fuelEntries: [],
        currentOdometerKm: 1_200,
      }),
    ).toEqual({ remainingLiters: 0, rangeKm: 0, fuelPercent: 0 })
  })

  it('returns null without learned consumption', () => {
    expect(
      estimateFuelRemaining({
        tankCapacityLiters: 3,
        consumptionKmPerLiter: null,
        initialAnchor,
        fuelEntries: [],
        currentOdometerKm: 1_000,
      }),
    ).toBeNull()
  })

  it.each([0, -1])('rejects consumption %s', (consumptionKmPerLiter) => {
    expect(() =>
      estimateFuelRemaining({
        tankCapacityLiters: 3,
        consumptionKmPerLiter,
        initialAnchor,
        fuelEntries: [],
        currentOdometerKm: 1_000,
      }),
    ).toThrow(RangeError)
  })

  it.each([0, -1])('rejects tank capacity %s', (tankCapacityLiters) => {
    expect(() =>
      estimateFuelRemaining({
        tankCapacityLiters,
        consumptionKmPerLiter: 40,
        initialAnchor,
        fuelEntries: [],
        currentOdometerKm: 1_000,
      }),
    ).toThrow(RangeError)
  })

  it('rejects an odometer below the latest full-tank anchor', () => {
    expect(() =>
      estimateFuelRemaining({
        tankCapacityLiters: 3,
        consumptionKmPerLiter: 40,
        initialAnchor,
        fuelEntries: [
          fuelEntry('full', 1_100, 2, true, '2026-01-02T10:00:00.000Z'),
        ],
        currentOdometerKm: 1_099,
      }),
    ).toThrow(RangeError)
  })

  it('resets to capacity at the latest full tank without adding its liters', () => {
    expect(
      estimateFuelRemaining({
        tankCapacityLiters: 3,
        consumptionKmPerLiter: 40,
        initialAnchor,
        fuelEntries: [
          fuelEntry('full', 1_040, 100, true, '2026-01-02T10:00:00.000Z'),
        ],
        currentOdometerKm: 1_080,
      })?.remainingLiters,
    ).toBe(2)
  })

  it('excludes partial fills before the latest full tank', () => {
    expect(
      estimateFuelRemaining({
        tankCapacityLiters: 3,
        consumptionKmPerLiter: 40,
        initialAnchor,
        fuelEntries: [
          fuelEntry('old-partial', 1_020, 1, false, '2026-01-02T10:00:00.000Z'),
          fuelEntry('full', 1_040, 1, true, '2026-01-03T10:00:00.000Z'),
        ],
        currentOdometerKm: 1_080,
      })?.remainingLiters,
    ).toBe(2)
  })

  it('does not reorder fuel entries while locating the latest anchor', () => {
    const entries = [
      fuelEntry('newer', 1_040, 1, true, '2026-01-03T10:00:00.000Z'),
      fuelEntry('older', 1_020, 0.5, false, '2026-01-02T10:00:00.000Z'),
    ]
    const originalOrder = entries.map(({ id }) => id)

    estimateFuelRemaining({
      tankCapacityLiters: 3,
      consumptionKmPerLiter: 40,
      initialAnchor,
      fuelEntries: entries,
      currentOdometerKm: 1_040,
    })

    expect(entries.map(({ id }) => id)).toEqual(originalOrder)
  })
})
