// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const syncStub = vi.hoisted(() => ({
  syncCurrentSessionIfOnline: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../infrastructure/sync/sync', () => syncStub)

import { resetLocalDatabase } from '../../infrastructure/local/db'
import { listFuelEntries, listOdometerReadings, saveFuelEntry } from '../../infrastructure/local/store'
import {
  initializeVehicle, recordFuel, recordOdometer,
  updateFuelEntry, updateOdometerReading,
} from './vehicleActions'

const at = '2026-10-20T10:00:00Z'
const later = '2026-10-21T10:00:00Z'

describe('pump measurements and editable odometer, local-first', () => {
  beforeEach(async () => { await resetLocalDatabase(); syncStub.syncCurrentSessionIfOnline.mockClear() })
  afterEach(async () => { await resetLocalDatabase(); vi.unstubAllGlobals() })

  it('saves measured liters without any API request and keeps capacity at 3 L', async () => {
    await initializeVehicle(1_000, true, at)
    const fetcher = vi.fn(() => { throw new Error('ANP must not be requested') })
    vi.stubGlobal('fetch', fetcher)
    const result = await recordFuel({
      odometerKm: 1_020, amountCents: 700, liters: 0.91,
      fullTank: false, fueledAt: later,
    })
    expect(result).toEqual({ kind: 'saved' })
    expect((await listFuelEntries())[0]).toMatchObject({
      amountCents: 700, liters: 0.91, estimatedLiters: null,
      referencePricePerLiter: null, syncStatus: 'pending',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([0, -1, 3.001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects volume %s', async (liters) => {
      await initializeVehicle(1_000, true, at)
      expect(await recordFuel({
        odometerKm: 1_020, amountCents: 700, liters,
        fullTank: false, fueledAt: later,
      })).toMatchObject({ kind: 'invalid', reason: 'Litragem inválida' })
      expect(await listFuelEntries()).toEqual([])
    },
  )

  it('corrects a legacy record without inventing a measured value', async () => {
    await initializeVehicle(1_000, true, at)
    const legacy = {
      id: 'abcdef12-0000-4000-8000-000000000123', odometerKm: 1_020,
      amountCents: 700, estimatedLiters: 1, referencePricePerLiter: 7,
      referenceWeekStart: null, referenceWeekEnd: null,
      fullTank: false, fueledAt: later, deletedAt: null,
      createdAt: later, updatedAt: later,
    }
    await saveFuelEntry(legacy)
    expect(await updateFuelEntry(legacy, {
      odometerKm: 1_020, amountCents: 800, liters: null,
      fullTank: false, fueledAt: later,
    }, '2026-10-22T10:00:00Z')).toEqual({ kind: 'saved' })
    expect((await listFuelEntries())[0]).toMatchObject({
      liters: null, estimatedLiters: 1.143, amountCents: 800,
    })
  })

  it('marks and corrects a manual empty reading in place', async () => {
    await initializeVehicle(1_000, true, at)
    await recordOdometer(1_040, later)
    const reading = (await listOdometerReadings()).find((row) => row.readingKm === 1_040)!
    const now = '2026-10-22T10:00:00Z'
    const corrected = await updateOdometerReading(
      reading, { readingKm: 1_041, recordedAt: later, tankEmpty: true }, now,
    )
    expect(corrected).toEqual({ kind: 'saved' })
    expect((await listOdometerReadings()).find((row) => row.id === reading.id)).toMatchObject({
      id: reading.id, readingKm: 1_041, tankEmpty: true,
      createdAt: reading.createdAt, updatedAt: now, syncStatus: 'pending',
    })
  })

  it('rejects a corrected reading that would exceed a later fuel event', async () => {
    await initializeVehicle(1_000, true, at)
    await recordOdometer(1_020, later)
    await recordFuel({
      odometerKm: 1_030, amountCents: 700, liters: 0.91,
      fullTank: false, fueledAt: '2026-10-22T10:00:00Z',
    })
    const reading = (await listOdometerReadings()).find((row) => row.readingKm === 1_020)!
    expect(await updateOdometerReading(reading, {
      readingKm: 1_031, recordedAt: later, tankEmpty: true,
    }, '2026-10-23T10:00:00Z')).toMatchObject({ kind: 'invalid' })
  })
})
