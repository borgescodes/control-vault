import { describe, expect, it } from 'vitest'

import type { FuelEntry } from './types'
import {
  buildConsumptionCycles,
  deriveRangeConfidence,
  type CalibrationState,
  type ConsumptionCycle,
} from './consumption'

function fuel(
  id: string,
  odometerKm: number,
  estimatedLiters: number | null,
  amountCents: number,
  fullTank: boolean,
  fueledAt: string,
): FuelEntry {
  return {
    id,
    odometerKm,
    amountCents,
    estimatedLiters,
    referencePricePerLiter: 7,
    referenceWeekStart: '2026-09-27',
    referenceWeekEnd: '2026-10-03',
    fullTank,
    fueledAt,
    deletedAt: null,
    createdAt: fueledAt,
    updatedAt: fueledAt,
  }
}

function cycle(endAt: string): ConsumptionCycle {
  return {
    startKm: 1_000,
    endKm: 1_100,
    startAt: '2026-01-01T10:00:00.000Z',
    endAt,
    distanceKm: 100,
    fuelUsedLiters: 3,
    fuelCostCents: 2_100,
    kmPerLiter: 100 / 3,
  }
}

describe('consumption cycle analytics', () => {
  it('records interval dates and sums cost across partial plus ending full refill', () => {
    expect(buildConsumptionCycles(
      { odometerKm: 1_000, at: '2026-01-01T10:00:00.000Z' },
      [
        fuel('partial', 1_050, 1, 700, false, '2026-01-05T10:00:00.000Z'),
        fuel('full', 1_100, 2, 1_400, true, '2026-01-10T10:00:00.000Z'),
      ],
    )).toEqual([
      {
        startKm: 1_000,
        endKm: 1_100,
        startAt: '2026-01-01T10:00:00.000Z',
        endAt: '2026-01-10T10:00:00.000Z',
        distanceKm: 100,
        fuelUsedLiters: 3,
        fuelCostCents: 2_100,
        kmPerLiter: 100 / 3,
      },
    ])
  })

  it('keeps a cycle invalid when any included refill has unknown liters', () => {
    expect(buildConsumptionCycles(
      { odometerKm: 1_000, at: '2026-01-01T10:00:00.000Z' },
      [
        fuel('unknown', 1_050, null, 700, false, '2026-01-05T10:00:00.000Z'),
        fuel('full', 1_100, 2, 1_400, true, '2026-01-10T10:00:00.000Z'),
      ],
    )).toEqual([])
  })
})

describe('range confidence', () => {
  const now = new Date('2026-10-05T12:00:00.000Z')
  const recentCycle = cycle('2026-09-20T10:00:00.000Z')
  const oldCycle = cycle('2026-06-01T10:00:00.000Z')

  it.each([
    ['calibrating', [], 'low'],
    ['estimated', [recentCycle], 'medium'],
    ['calibrated', [recentCycle], 'high'],
  ] as const)(
    'maps %s with recent evidence to %s',
    (state: CalibrationState, cycles, expected) => {
      expect(deriveRangeConfidence(state, [...cycles], now)).toBe(expected)
    },
  )

  it.each([
    ['calibrated', 'medium'],
    ['estimated', 'low'],
    ['calibrating', 'low'],
  ] as const)(
    'degrades stale %s confidence to %s',
    (state: CalibrationState, expected) => {
      expect(deriveRangeConfidence(state, [oldCycle], now)).toBe(expected)
    },
  )
})
