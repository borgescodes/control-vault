import 'fake-indexeddb/auto'

import { openDB } from 'idb'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  LOCAL_DATABASE_NAME,
  closeLocalDatabase,
  resetLocalDatabase,
} from './db'
import { listOdometerReadings } from './store'

async function seedVersion6DuplicateReadings() {
  await resetLocalDatabase()
  const database = await openDB(LOCAL_DATABASE_NAME, 6, {
    upgrade(db) {
      db.createObjectStore('vehicle_state')
      db.createObjectStore('sync_metadata')
      db.createObjectStore('odometer_readings', { keyPath: 'id' })
      db.createObjectStore('fuel_entries', { keyPath: 'id' })
      db.createObjectStore('saved_trips', { keyPath: 'id' })
    },
  })

  const base = {
    readingKm: 12_888.8,
    source: 'manual',
    syncStatus: 'synced',
  }
  await database.put('odometer_readings', {
    ...base,
    id: 'keep',
    recordedAt: '2026-10-05T03:43:59.757Z',
    createdAt: '2026-10-05T03:43:59.757Z',
    updatedAt: '2026-10-05T03:43:59.757Z',
  })
  await database.put('odometer_readings', {
    ...base,
    id: 'duplicate-a',
    recordedAt: '2026-10-05T13:10:59.414Z',
    createdAt: '2026-10-05T13:10:59.414Z',
    updatedAt: '2026-10-05T13:10:59.414Z',
  })
  await database.put('odometer_readings', {
    ...base,
    id: 'duplicate-b',
    recordedAt: '2026-10-05T13:11:01.329Z',
    createdAt: '2026-10-05T13:11:01.329Z',
    updatedAt: '2026-10-05T13:11:01.329Z',
  })
  database.close()
  await closeLocalDatabase()
}

describe('local database v6 to v7 odometer cleanup', () => {
  beforeEach(seedVersion6DuplicateReadings)
  afterAll(resetLocalDatabase)

  it('keeps the earliest manual reading for an identical odometer value', async () => {
    const readings = await listOdometerReadings()

    expect(readings).toEqual([
      expect.objectContaining({
        id: 'keep',
        readingKm: 12_888.8,
      }),
    ])
  })
})
