import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LOCAL_DATABASE_NAME, openLocalDatabase, resetLocalDatabase } from './db'

const oldAt = '2026-09-30T18:52:20.437Z'
const newAt = '2026-10-02T10:00:00.000Z'
const trip = { id: 'trip-1', origin: 'Casa', destination: 'Trabalho', outboundDistanceKm: 14.5, returnDistanceKm: null, deletedAt: null, createdAt: oldAt, updatedAt: oldAt, syncStatus: 'pending' }

async function seedVersion4(stateAt = oldAt) {
  const database = await openDB(LOCAL_DATABASE_NAME, 4, {
    upgrade(db) {
      db.createObjectStore('vehicle_state')
      db.createObjectStore('sync_metadata')
      for (const name of ['odometer_readings', 'fuel_entries', 'saved_trips']) db.createObjectStore(name, { keyPath: 'id' })
    },
  })
  await database.put('sync_metadata', 'owner-1', 'owner')
  await database.put('vehicle_state', { initialOdometerKm: 12_483, nominalTankCapacityLiters: 3, initialFullTankAt: stateAt, createdAt: stateAt, updatedAt: stateAt, syncStatus: 'synced' }, 'primary')
  for (const name of ['odometer_readings', 'fuel_entries']) {
    await database.put(name, { id: 'old', createdAt: oldAt, syncStatus: 'pending' })
    await database.put(name, { id: 'new', createdAt: newAt, syncStatus: 'pending' })
  }
  await database.put('saved_trips', trip)
  database.close()
}

describe('authorized one-time vehicle reset', () => {
  beforeEach(resetLocalDatabase)
  afterEach(resetLocalDatabase)

  it('clears existing vehicle records while preserving trips and owner', async () => {
    await seedVersion4()
    const database = await openLocalDatabase()
    expect(await database.get('vehicle_state', 'primary')).toBeUndefined()
    for (const name of ['odometer_readings', 'fuel_entries'] as const) {
      expect((await database.getAll(name)).map(({ id }) => id)).toEqual(['new'])
    }
    expect(await database.getAll('saved_trips')).toEqual([trip])
    expect(await database.get('sync_metadata', 'owner')).toBe('owner-1')
  })

  it('preserves setup and entries created after the reset cutoff', async () => {
    await seedVersion4(newAt)
    const database = await openLocalDatabase()
    expect(await database.get('vehicle_state', 'primary')).toMatchObject({ createdAt: newAt })
    expect(await database.getAll('saved_trips')).toEqual([trip])
    expect(await database.get('fuel_entries', 'new')).toMatchObject({ createdAt: newAt })
  })
})
