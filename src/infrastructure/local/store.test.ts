import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import type {
  FuelEntry,
  OdometerReading,
  VehicleState,
} from '../../modules/vehicle/domain/types'
import { closeLocalDatabase, LOCAL_DATABASE_NAME, resetLocalDatabase } from './db'
import {
  getVehicleState,
  initializeLocalVehicle,
  isLocalDatabaseEmpty,
  listFuelEntries,
  listOdometerReadings,
  listPending,
  markSynced,
  saveFuelAndReading,
  saveFuelEntry,
  saveOdometerReading,
  saveVehicleState,
  claimSyncOwner,
  mergeRemoteVehicleData,
  subscribeToLocalChanges,
} from './store'

const timestamp = '2026-09-29T12:00:00.000Z'

function vehicleState(): VehicleState {
  return {
    nominalTankCapacityLiters: 14,
    initialOdometerKm: 12_000,
    initialFullTankAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function odometerReading(
  id: string,
  source: OdometerReading['source'] = 'manual',
): OdometerReading {
  return {
    id,
    readingKm: 12_100,
    recordedAt: timestamp,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function fuelEntry(id: string): FuelEntry {
  return {
    id,
    odometerKm: 12_100,
    amountCents: 7_500,
    estimatedLiters: 10,
    referencePricePerLiter: null,
    referenceWeekStart: null,
    referenceWeekEnd: null,
    fullTank: true,
    fueledAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

describe('local vehicle store', () => {
  beforeEach(resetLocalDatabase)
  afterAll(resetLocalDatabase)

  it('notifies observers only after durable compound local writes', async () => {
    const changes: string[] = []
    const unsubscribe = subscribeToLocalChanges((change) => changes.push(change))
    try {
      await initializeLocalVehicle(vehicleState(), odometerReading('initial'))
      await saveFuelAndReading(fuelEntry('fill'), odometerReading('fill-reading', 'fuel_entry'))
      expect(changes).toEqual(['write', 'write'])
    } finally { unsubscribe() }
  })

  it('keeps a write changed during its remote acknowledgment pending', async () => {
    const sent = fuelEntry('race');
    await saveFuelEntry(sent)
    await saveFuelEntry({ ...sent, amountCents: 8_000 })
    await markSynced('fuel_entries', sent.id, { ...sent, syncStatus: 'pending' })
    expect((await listFuelEntries())[0]).toMatchObject({ amountCents: 8_000, syncStatus: 'pending' })
  })

  it('merges confirmed server data without replacing pending local writes', async () => {
    await saveFuelEntry(fuelEntry('pending'))
    await saveFuelEntry(fuelEntry('confirmed'))
    await markSynced('fuel_entries', 'confirmed')
    await mergeRemoteVehicleData({ vehicleState: null, odometerReadings: [], fuelEntries: [
      { ...fuelEntry('pending'), amountCents: 1_000 },
      { ...fuelEntry('confirmed'), amountCents: 2_000 },
      fuelEntry('another-device'),
    ] })
    expect(await listFuelEntries()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'pending', amountCents: 7_500, syncStatus: 'pending' }),
      expect.objectContaining({ id: 'confirmed', amountCents: 2_000, syncStatus: 'synced' }),
      expect.objectContaining({ id: 'another-device', syncStatus: 'synced' }),
    ]))
  })

  it('binds the personal database to one sync owner without deleting data', async () => {
    await saveFuelEntry(fuelEntry('personal'))
    await claimSyncOwner('owner-a')
    await closeLocalDatabase()
    await claimSyncOwner('owner-a')
    await expect(claimSyncOwner('owner-b')).rejects.toThrow('outra conta')
    expect(await listFuelEntries()).toHaveLength(1)
  })

  it('returns a saved record immediately with pending sync status', async () => {
    const state = vehicleState()

    await saveVehicleState(state)

    await expect(getVehicleState()).resolves.toEqual({
      ...state,
      syncStatus: 'pending',
    })
  })

  it('marks only the targeted record as synced', async () => {
    await saveOdometerReading(odometerReading('reading-1'))
    await saveOdometerReading(odometerReading('reading-2'))

    await markSynced('odometer_readings', 'reading-1')

    const readings = await listOdometerReadings()
    expect(readings).toEqual([
      expect.objectContaining({ id: 'reading-1', syncStatus: 'synced' }),
      expect.objectContaining({ id: 'reading-2', syncStatus: 'pending' }),
    ])
  })

  it('keeps records after the database is closed and reopened', async () => {
    const entry = fuelEntry('fuel-1')
    await saveFuelEntry(entry)

    await closeLocalDatabase()

    await expect(listFuelEntries()).resolves.toEqual([
      { ...entry, syncStatus: 'pending' },
    ])
  })

  it('lists pending state, odometer readings and fuel entries', async () => {
    const state = vehicleState()
    const pendingReading = odometerReading('reading-pending')
    const syncedReading = odometerReading('reading-synced')
    const entry = fuelEntry('fuel-pending')
    await saveVehicleState(state)
    await saveOdometerReading(pendingReading)
    await saveOdometerReading(syncedReading)
    await saveFuelEntry(entry)
    await markSynced('odometer_readings', syncedReading.id)

    await expect(listPending()).resolves.toEqual([
      { kind: 'vehicle_state', id: 'primary', record: { ...state, syncStatus: 'pending' } },
      {
        kind: 'odometer_readings',
        id: pendingReading.id,
        record: { ...pendingReading, syncStatus: 'pending' },
      },
      {
        kind: 'fuel_entries',
        id: entry.id,
        record: { ...entry, syncStatus: 'pending' },
      },
    ])
  })

  it('preserves supplied record IDs', async () => {
    const reading = odometerReading('client-reading-id')
    const entry = fuelEntry('client-fuel-id')

    await saveOdometerReading(reading)
    await saveFuelEntry(entry)

    expect((await listOdometerReadings())[0].id).toBe(reading.id)
    expect((await listFuelEntries())[0].id).toBe(entry.id)
  })

  it('initializes vehicle state and its first reading atomically', async () => {
    const state = vehicleState()
    const reading = odometerReading('initial-reading')

    await initializeLocalVehicle(state, reading)

    await expect(getVehicleState()).resolves.toEqual({
      ...state,
      syncStatus: 'pending',
    })
    await expect(listOdometerReadings()).resolves.toEqual([
      { ...reading, syncStatus: 'pending' },
    ])
  })

  it('rolls back vehicle initialization when the second write fails', async () => {
    const invalidReading = {
      ...odometerReading('invalid-reading'),
      id: undefined,
    } as unknown as OdometerReading

    await expect(
      initializeLocalVehicle(vehicleState(), invalidReading),
    ).rejects.toBeDefined()

    await expect(getVehicleState()).resolves.toBeNull()
    await expect(listOdometerReadings()).resolves.toEqual([])
  })

  it('saves a fuel entry and its odometer reading atomically', async () => {
    const entry = fuelEntry('fuel-with-reading')
    const reading = odometerReading('fuel-reading', 'fuel_entry')

    await saveFuelAndReading(entry, reading)

    await expect(listFuelEntries()).resolves.toEqual([
      { ...entry, syncStatus: 'pending' },
    ])
    await expect(listOdometerReadings()).resolves.toEqual([
      { ...reading, syncStatus: 'pending' },
    ])
  })

  it('rolls back a fuel entry when the second write fails', async () => {
    const invalidReading = {
      ...odometerReading('invalid-reading', 'fuel_entry'),
      id: undefined,
    } as unknown as OdometerReading

    await expect(
      saveFuelAndReading(fuelEntry('rolled-back-fuel'), invalidReading),
    ).rejects.toBeDefined()

    await expect(listFuelEntries()).resolves.toEqual([])
    await expect(listOdometerReadings()).resolves.toEqual([])
  })

  it('reports whether the local database is empty', async () => {
    await expect(isLocalDatabaseEmpty()).resolves.toBe(true)

    await saveFuelEntry(fuelEntry('fuel-1'))

    await expect(isLocalDatabaseEmpty()).resolves.toBe(false)
  })
})


async function createLegacyV1Database() {
  await resetLocalDatabase()

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME, 1)

    request.onupgradeneeded = () => {
      const database = request.result
      database.createObjectStore('vehicle_state')
      database.createObjectStore('odometer_readings', { keyPath: 'id' })
      database.createObjectStore('fuel_entries', { keyPath: 'id' })
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction(
        ['vehicle_state', 'fuel_entries'],
        'readwrite',
      )

      transaction.objectStore('vehicle_state').put(
        {
          tankCapacityLiters: 14,
          initialOdometerKm: 12_000,
          initialFullTankAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'synced',
        },
        'primary',
      )
      transaction.objectStore('fuel_entries').put({
        id: 'legacy-fuel',
        odometerKm: 12_100,
        amountCents: 7_500,
        liters: 10,
        fullTank: true,
        fueledAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      })

      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
    }
  })
}

describe('local vehicle store v1 to v2 migration', () => {
  it('migrates legacy vehicle and fuel fields without losing metadata', async () => {
    await createLegacyV1Database()

    const state = await getVehicleState()
    const entries = await listFuelEntries()

    expect(state).toMatchObject({
      nominalTankCapacityLiters: 14,
      initialOdometerKm: 12_000,
      initialFullTankAt: timestamp,
      syncStatus: 'synced',
    })
    expect(state).not.toHaveProperty('tankCapacityLiters')

    expect(entries).toEqual([
      expect.objectContaining({
        id: 'legacy-fuel',
        estimatedLiters: 10,
        referencePricePerLiter: null,
        referenceWeekStart: null,
        referenceWeekEnd: null,
        syncStatus: 'pending',
      }),
    ])
    expect(entries[0]).not.toHaveProperty('liters')
  })
})
