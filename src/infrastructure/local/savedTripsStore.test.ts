import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import type { SavedTrip } from '../../modules/vehicle/domain/types'
import { resetLocalDatabase } from './db'
import {
  getSavedTrip,
  listAllSavedTrips,
  listPending,
  listSavedTrips,
  mergeRemoteVehicleData,
  saveHydratedVehicleData,
  saveSavedTrip,
  softDeleteSavedTrip,
} from './store'

const createdAt = '2026-10-01T12:00:00.000Z'

function trip(overrides: Partial<SavedTrip> = {}): SavedTrip {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    origin: 'Casa',
    destination: 'Juparanã',
    outboundDistanceKm: 14,
    returnDistanceKm: 16,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

describe('saved trips local persistence', () => {
  beforeEach(async () => {
    await resetLocalDatabase()
  })

  afterAll(async () => {
    await resetLocalDatabase()
  })

  it('stores a saved trip as pending and lists it as visible', async () => {
    await saveSavedTrip(trip())

    await expect(listSavedTrips()).resolves.toEqual([
      { ...trip(), syncStatus: 'pending' },
    ])
    await expect(listPending()).resolves.toEqual([
      expect.objectContaining({
        kind: 'saved_trips',
        id: trip().id,
      }),
    ])
  })

  it('updates a trip using the same stable id', async () => {
    await saveSavedTrip(trip())
    await saveSavedTrip(
      trip({
        destination: 'Trabalho',
        outboundDistanceKm: 8.4,
        returnDistanceKm: null,
        updatedAt: '2026-10-01T13:00:00.000Z',
      }),
    )

    await expect(listSavedTrips()).resolves.toEqual([
      expect.objectContaining({
        id: trip().id,
        destination: 'Trabalho',
        outboundDistanceKm: 8.4,
        returnDistanceKm: null,
        syncStatus: 'pending',
      }),
    ])
  })

  it('soft-deletes locally while retaining a pending tombstone for sync', async () => {
    await saveSavedTrip(trip())
    const deletedAt = '2026-10-01T14:00:00.000Z'

    await expect(softDeleteSavedTrip(trip().id, deletedAt)).resolves.toBe(true)
    await expect(listSavedTrips()).resolves.toEqual([])
    await expect(listAllSavedTrips()).resolves.toEqual([
      expect.objectContaining({
        id: trip().id,
        deletedAt,
        updatedAt: deletedAt,
        syncStatus: 'pending',
      }),
    ])
  })

  it('hydrates remote saved trips as synced and hides remote tombstones', async () => {
    await saveHydratedVehicleData({
      vehicleState: null,
      odometerReadings: [],
      fuelEntries: [],
      savedTrips: [
        trip(),
        trip({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          deletedAt: '2026-10-01T15:00:00.000Z',
        }),
      ],
    })

    await expect(listSavedTrips()).resolves.toEqual([
      { ...trip(), syncStatus: 'synced' },
    ])
    await expect(listAllSavedTrips()).resolves.toHaveLength(2)
  })

  it('does not overwrite a newer pending local trip during remote merge', async () => {
    await saveSavedTrip(
      trip({ destination: 'Local novo', updatedAt: '2026-10-01T16:00:00.000Z' }),
    )

    await mergeRemoteVehicleData({
      vehicleState: null,
      odometerReadings: [],
      fuelEntries: [],
      savedTrips: [trip({ destination: 'Remoto antigo' })],
    })

    await expect(getSavedTrip(trip().id)).resolves.toEqual(
      expect.objectContaining({
        destination: 'Local novo',
        syncStatus: 'pending',
      }),
    )
  })
})
