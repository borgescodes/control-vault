import { describe, expect, it } from 'vitest'

import type { FuelEntry, OdometerReading } from './types'
import {
  getLatestOdometerKm,
  getOdometerTimeline,
  validateFuelEntryPosition,
} from './odometer'

function reading(
  id: string,
  readingKm: number,
  recordedAt: string,
  source: OdometerReading['source'] = 'manual',
): OdometerReading {
  return {
    id,
    readingKm,
    recordedAt,
    source,
    createdAt: recordedAt,
    updatedAt: recordedAt,
  }
}

function fuel(
  id: string,
  odometerKm: number,
  fueledAt: string,
  deletedAt: string | null = null,
): FuelEntry {
  return {
    id,
    odometerKm,
    amountCents: 2_000,
    estimatedLiters: 2.8,
    referencePricePerLiter: 7.05,
    referenceWeekStart: '2026-09-27',
    referenceWeekEnd: '2026-10-03',
    fullTank: false,
    fueledAt,
    deletedAt,
    createdAt: fueledAt,
    updatedAt: fueledAt,
  }
}

describe('canonical odometer timeline', () => {
  it('combines manual readings with active fuel entries in chronological order', () => {
    expect(getOdometerTimeline(
      [
        reading('manual-later', 1_200, '2026-10-03T10:00:00.000Z'),
        reading('manual-earlier', 1_000, '2026-10-01T10:00:00.000Z'),
      ],
      [fuel('fuel-middle', 1_100, '2026-10-02T10:00:00.000Z')],
    )).toEqual([
      {
        id: 'manual-earlier',
        at: '2026-10-01T10:00:00.000Z',
        odometerKm: 1_000,
        source: 'manual',
      },
      {
        id: 'fuel-middle',
        at: '2026-10-02T10:00:00.000Z',
        odometerKm: 1_100,
        source: 'fuel',
      },
      {
        id: 'manual-later',
        at: '2026-10-03T10:00:00.000Z',
        odometerKm: 1_200,
        source: 'manual',
      },
    ])
  })

  it('ignores legacy fuel-generated readings and tombstoned fuel entries', () => {
    expect(getOdometerTimeline(
      [
        reading('manual', 1_000, '2026-10-01T10:00:00.000Z'),
        reading('legacy', 9_999, '2026-10-04T10:00:00.000Z', 'fuel_entry'),
      ],
      [
        fuel(
          'deleted-fuel',
          8_888,
          '2026-10-05T10:00:00.000Z',
          '2026-10-06T10:00:00.000Z',
        ),
      ],
    )).toEqual([
      {
        id: 'manual',
        at: '2026-10-01T10:00:00.000Z',
        odometerKm: 1_000,
        source: 'manual',
      },
    ])
  })

  it('returns the latest active odometer with a fallback', () => {
    expect(getLatestOdometerKm(
      [reading('manual', 1_050, '2026-10-01T10:00:00.000Z')],
      [fuel('fuel', 1_100, '2026-10-02T10:00:00.000Z')],
      1_000,
    )).toBe(1_100)

    expect(getLatestOdometerKm([], [], 1_000)).toBe(1_000)
    expect(getLatestOdometerKm([], [])).toBeNull()
  })
})


describe('fuel correction position validation', () => {
  const readings = [
    reading('before', 1_000, '2026-10-01T10:00:00.000Z'),
    reading('after', 1_200, '2026-10-03T10:00:00.000Z'),
    reading('current', 1_300, '2026-10-04T10:00:00.000Z'),
  ]
  const entries = [
    fuel('target', 1_100, '2026-10-02T10:00:00.000Z'),
  ]

  it('accepts a historical correction between chronological neighbors', () => {
    expect(validateFuelEntryPosition(
      readings,
      entries,
      'target',
      1_150,
      '2026-10-02T10:00:00.000Z',
    )).toEqual({ kind: 'valid', deltaKm: 150 })
  })

  it('rejects crossing the previous chronological neighbor', () => {
    expect(validateFuelEntryPosition(
      readings,
      entries,
      'target',
      999,
      '2026-10-02T10:00:00.000Z',
    )).toMatchObject({ kind: 'invalid' })
  })

  it('rejects crossing the next chronological neighbor', () => {
    expect(validateFuelEntryPosition(
      readings,
      entries,
      'target',
      1_201,
      '2026-10-02T10:00:00.000Z',
    )).toMatchObject({ kind: 'invalid' })
  })

  it('validates against the neighbors at the edited timestamp', () => {
    expect(validateFuelEntryPosition(
      [
        ...readings,
        reading('later', 1_400, '2026-10-06T10:00:00.000Z'),
      ],
      entries,
      'target',
      1_350,
      '2026-10-05T10:00:00.000Z',
    )).toEqual({ kind: 'valid', deltaKm: 50 })
  })

  it('returns suspicious for a large jump that still fits between neighbors', () => {
    expect(validateFuelEntryPosition(
      [
        reading('before', 1_000, '2026-10-01T10:00:00.000Z'),
        reading('after', 1_700, '2026-10-03T10:00:00.000Z'),
      ],
      entries,
      'target',
      1_500.1,
      '2026-10-02T10:00:00.000Z',
    )).toEqual({ kind: 'suspicious', deltaKm: 500.0999999999999 })
  })
})
