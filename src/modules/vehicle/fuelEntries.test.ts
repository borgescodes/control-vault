import { describe, expect, it } from 'vitest'
import type { FuelEntry } from './domain/types'
import { uniqueFuelEntries } from './fuelEntries'

const original: FuelEntry = {
  id: 'original', odometerKm: 1_100, amountCents: 2_005, estimatedLiters: 2.843,
  referencePricePerLiter: 7.05, referenceWeekStart: '2026-09-21', referenceWeekEnd: '2026-09-27',
  fullTank: true, fueledAt: '2026-09-30T20:00:00Z', createdAt: '2026-09-30T20:00:00Z', updatedAt: '2026-09-30T20:00:00Z',
}

describe('uniqueFuelEntries', () => {
  it('keeps the earliest repeated full tank without mutating storage records', () => {
    const entries = [{ ...original, id: 'copy', fueledAt: '2026-10-01T20:00:00Z' }, original]
    const before = structuredClone(entries)
    expect(uniqueFuelEntries(entries)).toEqual([original])
    expect(entries).toEqual(before)
  })

  it('excludes tombstoned fuel entries before duplicate filtering', () => {
    expect(uniqueFuelEntries([
      original,
      {
        ...original,
        id: 'deleted',
        fueledAt: '2026-10-01T20:00:00Z',
        deletedAt: '2026-10-02T10:00:00Z',
      },
    ])).toEqual([original])
  })

  it('preserves repeated partial refuels', () => {
    expect(uniqueFuelEntries([
      { ...original, fullTank: false }, { ...original, id: 'other', fullTank: false },
    ])).toHaveLength(2)
  })

  it.each([
    { odometerKm: 1_200 }, { amountCents: 2_000 }, { estimatedLiters: null },
    { referencePricePerLiter: 7.1 }, { referenceWeekStart: '2026-09-28' }, { referenceWeekEnd: '2026-10-04' },
  ])('preserves a different full-tank record: %j', (change) => {
    expect(uniqueFuelEntries([original, { ...original, id: 'different', ...change }])).toHaveLength(2)
  })

  it('uses a stable ID tie-breaker when timestamps match', () => {
    const entries = [{ ...original, id: 'b' }, { ...original, id: 'a' }]
    expect(uniqueFuelEntries(entries).map(({ id }) => id)).toEqual(['a'])
    expect(uniqueFuelEntries([...entries].reverse()).map(({ id }) => id)).toEqual(['a'])
  })
})
