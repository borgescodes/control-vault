import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import type { FuelEntry } from '../../modules/vehicle/domain/types'
import { uniqueFuelEntries } from '../../modules/vehicle/fuelEntries'
import { resetLocalDatabase } from './db'
import {
  getFuelEntry,
  listFuelEntries,
  markSynced,
  saveFuelEntry,
  saveFuelEntryCorrection,
  softDeleteFuelEntry,
} from './store'

const createdAt = '2026-10-01T10:00:00.000Z'
const updatedAt = '2026-10-02T10:00:00.000Z'

function entry(id = 'fuel-1'): FuelEntry {
  return {
    id,
    odometerKm: 1_100,
    amountCents: 2_000,
    estimatedLiters: 2.837,
    referencePricePerLiter: 7.05,
    referenceWeekStart: '2026-09-27',
    referenceWeekEnd: '2026-10-03',
    fullTank: false,
    fueledAt: createdAt,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  }
}

describe('fuel entry correction store', () => {
  beforeEach(resetLocalDatabase)
  afterAll(resetLocalDatabase)

  it('updates the same record and marks the correction pending', async () => {
    const original = entry()
    await saveFuelEntry(original)
    await markSynced('fuel_entries', original.id)

    await expect(saveFuelEntryCorrection(
      {
        ...original,
        odometerKm: 1_150,
        amountCents: 2_115,
        updatedAt,
      },
      () => true,
    )).resolves.toBe(true)

    await expect(getFuelEntry(original.id)).resolves.toMatchObject({
      id: original.id,
      createdAt,
      updatedAt,
      odometerKm: 1_150,
      amountCents: 2_115,
      syncStatus: 'pending',
    })
  })

  it('soft-deletes without physically removing the record', async () => {
    const original = entry()
    await saveFuelEntry(original)
    await markSynced('fuel_entries', original.id)

    await expect(softDeleteFuelEntry(original.id, updatedAt)).resolves.toBe(true)

    const stored = await listFuelEntries()
    expect(stored).toEqual([
      expect.objectContaining({
        id: original.id,
        deletedAt: updatedAt,
        updatedAt,
        syncStatus: 'pending',
      }),
    ])
    expect(uniqueFuelEntries(stored)).toEqual([])
  })

  it('returns false when deleting an unknown fuel entry', async () => {
    await expect(softDeleteFuelEntry('missing', updatedAt)).resolves.toBe(false)
  })
})
