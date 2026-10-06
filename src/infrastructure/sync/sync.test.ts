import 'fake-indexeddb/auto'

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  closeLocalDatabase,
  resetLocalDatabase,
} from '../local/db'
import {
  getVehicleState,
  listAllSavedTrips,
  listFuelEntries,
  listOdometerReadings,
  listPending,
  listSavedTrips,
  saveFuelEntry,
  saveOdometerReading,
  saveSavedTrip,
  saveVehicleState,
  softDeleteFuelEntry,
  softDeleteSavedTrip,
} from '../local/store'
import type {
  FuelEntry,
  OdometerReading,
  SavedTrip,
  VehicleState,
} from '../../modules/vehicle/domain/types'
import {
  refreshFromRemote,
  runSync,
  syncCurrentSessionIfOnline,
  syncPending,
} from './sync'

type Table = 'vehicle_state' | 'odometer_readings' | 'fuel_entries' | 'saved_trips'
type Row = Record<string, unknown>

const supabaseStub = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('../supabase/client', () => ({
  supabase: {
    from: supabaseStub.from,
    auth: { getSession: supabaseStub.getSession },
  },
}))

const userId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const createdAt = '2026-09-29T10:00:00.000Z'
const updatedAt = '2026-09-29T11:00:00.000Z'

function vehicleState(overrides: Partial<VehicleState> = {}): VehicleState {
  return {
    nominalTankCapacityLiters: 3,
    initialOdometerKm: 1_000,
    initialFullTankAt: createdAt,
    createdAt,
    updatedAt,
    ...overrides,
  }
}

function odometerReading(
  id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  overrides: Partial<OdometerReading> = {},
): OdometerReading {
  return {
    id,
    readingKm: 1_050.5,
    recordedAt: updatedAt,
    source: 'manual',
    createdAt,
    updatedAt,
    ...overrides,
  }
}

function fuelEntry(
  id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  overrides: Partial<FuelEntry> = {},
): FuelEntry {
  return {
    id,
    odometerKm: 1_050.5,
    amountCents: 2_640,
    estimatedLiters: 1.5,
    referencePricePerLiter: null,
    referenceWeekStart: null,
    referenceWeekEnd: null,
    fullTank: true,
    fueledAt: updatedAt,
    deletedAt: null,
    createdAt,
    updatedAt,
    ...overrides,
  }
}

function savedTrip(
  id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  overrides: Partial<SavedTrip> = {},
): SavedTrip {
  return {
    id,
    origin: 'Casa',
    destination: 'Juparanã',
    outboundDistanceKm: 14,
    returnDistanceKm: 16,
    deletedAt: null,
    createdAt,
    updatedAt,
    ...overrides,
  }
}

function remoteVehicle(owner = userId): Row {
  return {
    user_id: owner,
    tank_capacity_liters: 3,
    initial_odometer_km: 1_000,
    initial_full_tank_at: createdAt,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function remoteOdometer(
  id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  owner = userId,
): Row {
  return {
    id,
    user_id: owner,
    reading_km: 1_050.5,
    recorded_at: updatedAt,
    source: 'manual',
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function remoteFuel(
  id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  owner = userId,
  overrides: Row = {},
): Row {
  return {
    id,
    user_id: owner,
    odometer_km: 1_050.5,
    amount_cents: 2_640,
    estimated_liters: 1.5,
    reference_price_per_liter: null,
    reference_week_start: null,
    reference_week_end: null,
    full_tank: true,
    fueled_at: updatedAt,
    deleted_at: null,
    created_at: createdAt,
    updated_at: updatedAt,
    ...overrides,
  }
}

function remoteTrip(
  id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  owner = userId,
  overrides: Row = {},
): Row {
  return {
    id,
    user_id: owner,
    origin: 'Casa',
    destination: 'Juparanã',
    outbound_distance_km: 14,
    return_distance_km: 16,
    deleted_at: null,
    created_at: createdAt,
    updated_at: updatedAt,
    ...overrides,
  }
}

function createRemote(initial: Partial<Record<Table, Row[]>> = {}) {
  const rows: Record<Table, Row[]> = {
    vehicle_state: [...(initial.vehicle_state ?? [])],
    odometer_readings: [...(initial.odometer_readings ?? [])],
    fuel_entries: [...(initial.fuel_entries ?? [])],
    saved_trips: [...(initial.saved_trips ?? [])],
  }
  const upserts: Array<{
    table: Table
    payload: Row
    onConflict: string | undefined
  }> = []
  const selects: Array<{ table: Table; column: string; value: string }> = []
  const failingUpserts = new Set<string>()
  const failingSelects = new Set<Table>()
  let upsertGate: Promise<void> | undefined

  supabaseStub.from.mockImplementation((table: Table) => ({
    upsert: async (
      payload: Row,
      options?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) => {
      upserts.push({ table, payload, onConflict: options?.onConflict })
      await upsertGate

      const key = table === 'vehicle_state' ? 'user_id' : 'id'
      if (failingUpserts.has(`${table}:${String(payload[key])}`)) {
        return { error: new Error('remote write failed') }
      }

      const index = rows[table].findIndex(
        (row) => row[key] === payload[key],
      )
      if (index === -1) {
        rows[table].push({ ...payload })
      } else if (!options?.ignoreDuplicates) {
        rows[table][index] = { ...payload }
      }
      return { error: null }
    },
    select: () => ({
      eq: (column: string, value: string) => ({ order: () => ({ range: async (start: number, end: number) => {
        selects.push({ table, column, value })
        if (failingSelects.has(table)) {
          return { data: null, error: new Error('remote read failed') }
        }
        return {
          data: rows[table].filter((row) => row[column] === value).slice(start, end + 1),
          error: null,
        }
      } }) }),
    }),
  }))

  return {
    rows,
    upserts,
    selects,
    failingUpserts,
    failingSelects,
    holdUpserts(promise: Promise<void>) {
      upsertGate = promise
    },
  }
}

describe('authenticated vehicle sync', () => {
  beforeEach(async () => {
    await resetLocalDatabase()
    supabaseStub.from.mockReset()
    supabaseStub.getSession.mockReset()
  })

  afterEach(() => vi.unstubAllGlobals())

  afterAll(async () => {
    await resetLocalDatabase()
  })

  it('maps pending vehicle state to the remote schema', async () => {
    const remote = createRemote()
    await saveVehicleState(vehicleState())

    await syncPending(userId)

    expect(remote.upserts).toEqual([
      {
        table: 'vehicle_state',
        onConflict: 'user_id',
        payload: remoteVehicle(),
      },
    ])
  })

  it('overwrites an existing remote vehicle state when capacity changes', async () => {
    const remote = createRemote({
      vehicle_state: [
        {
          ...remoteVehicle(),
          tank_capacity_liters: 3.5,
          updated_at: createdAt,
        },
      ],
    })
    await saveVehicleState(
      vehicleState({
        nominalTankCapacityLiters: 3,
        updatedAt: '2026-10-06T22:00:00.000Z',
      }),
    )

    await syncPending(userId)

    expect(remote.rows.vehicle_state).toEqual([
      expect.objectContaining({
        tank_capacity_liters: 3,
        updated_at: '2026-10-06T22:00:00.000Z',
      }),
    ])
  })

  it('maps a pending odometer reading to the remote schema', async () => {
    const remote = createRemote()
    await saveOdometerReading(odometerReading())

    await syncPending(userId)

    expect(remote.upserts).toEqual([
      {
        table: 'odometer_readings',
        onConflict: 'id',
        payload: remoteOdometer(),
      },
    ])
  })

  it('maps a pending fuel entry to the remote schema', async () => {
    const remote = createRemote()
    await saveFuelEntry(fuelEntry())

    await syncPending(userId)

    expect(remote.upserts).toEqual([
      {
        table: 'fuel_entries',
        onConflict: 'id',
        payload: remoteFuel(),
      },
    ])
  })

  it('maps a pending saved trip to the remote schema', async () => {
    const remote = createRemote()
    await saveSavedTrip(savedTrip())

    await syncPending(userId)

    expect(remote.upserts).toEqual([
      {
        table: 'saved_trips',
        onConflict: 'id',
        payload: remoteTrip(),
      },
    ])
  })

  it('does not send syncStatus or an accidental local user_id', async () => {
    const remote = createRemote()
    await saveFuelEntry({
      ...fuelEntry(),
      user_id: otherUserId,
    } as FuelEntry)

    await syncPending(userId)

    expect(remote.upserts[0].payload).not.toHaveProperty('syncStatus')
    expect(remote.upserts[0].payload.user_id).toBe(userId)
  })

  it('marks only successful records as synced', async () => {
    const remote = createRemote()
    const first = odometerReading()
    const second = odometerReading('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    await saveOdometerReading(first)
    await saveOdometerReading(second)
    remote.failingUpserts.add(`odometer_readings:${second.id}`)

    const result = await syncPending(userId)

    expect(result).toEqual({ synced: 1, pending: 1, failed: 1 })
    await expect(listPending()).resolves.toEqual([
      expect.objectContaining({ id: second.id }),
    ])
  })

  it('keeps a failed upsert pending', async () => {
    const entry = fuelEntry()
    const remote = createRemote()
    remote.failingUpserts.add(`fuel_entries:${entry.id}`)
    await saveFuelEntry(entry)

    const result = await syncPending(userId)

    expect(result).toEqual({ synced: 0, pending: 1, failed: 1 })
    await expect(listPending()).resolves.toHaveLength(1)
  })

  it('continues after one remote record fails', async () => {
    const remote = createRemote()
    const reading = odometerReading()
    await saveOdometerReading(reading)
    await saveFuelEntry(fuelEntry())
    remote.failingUpserts.add(`odometer_readings:${reading.id}`)

    const result = await syncPending(userId)

    expect(result).toEqual({ synced: 1, pending: 1, failed: 1 })
    expect(remote.rows.fuel_entries).toHaveLength(1)
  })

  it('retries a record on a later run', async () => {
    const entry = fuelEntry()
    const remote = createRemote()
    remote.failingUpserts.add(`fuel_entries:${entry.id}`)
    await saveFuelEntry(entry)
    await syncPending(userId)
    remote.failingUpserts.clear()

    const result = await syncPending(userId)

    expect(result).toEqual({ synced: 1, pending: 0, failed: 0 })
  })

  it('does not create a duplicate when the same ID is retried', async () => {
    const entry = fuelEntry()
    const remote = createRemote()
    await saveFuelEntry(entry)
    await syncPending(userId)
    await saveFuelEntry(entry)

    await syncPending(userId)

    expect(remote.rows.fuel_entries).toHaveLength(1)
  })

  it('updates an existing remote row with the same ID', async () => {
    const entry = fuelEntry()
    const remote = createRemote({ fuel_entries: [remoteFuel()] })
    await saveFuelEntry({ ...entry, amountCents: 3_100 })

    await syncPending(userId)

    expect(remote.rows.fuel_entries).toEqual([
      expect.objectContaining({ id: entry.id, amount_cents: 3_100 }),
    ])
  })

  it('makes no remote calls for an empty user ID', async () => {
    createRemote()
    await saveVehicleState(vehicleState())

    const result = await syncPending('')

    expect(result).toEqual({ synced: 0, pending: 1, failed: 0 })
    expect(supabaseStub.from).not.toHaveBeenCalled()
  })

  it('makes no remote calls for a whitespace user ID', async () => {
    createRemote()
    await saveFuelEntry(fuelEntry())

    await syncPending('   ')

    expect(supabaseStub.from).not.toHaveBeenCalled()
    await expect(listPending()).resolves.toHaveLength(1)
  })

  it('pushes a fuel tombstone through deleted_at', async () => {
    const remote = createRemote({ fuel_entries: [remoteFuel()] })
    const entry = fuelEntry()
    await saveFuelEntry(entry)
    await softDeleteFuelEntry(entry.id, '2026-10-01T16:00:00.000Z')

    await syncPending(userId)

    expect(remote.rows.fuel_entries).toEqual([
      expect.objectContaining({
        id: entry.id,
        deleted_at: '2026-10-01T16:00:00.000Z',
      }),
    ])
  })

  it('hydrates a remote fuel tombstone as synced', async () => {
    createRemote({
      fuel_entries: [
        remoteFuel(undefined, userId, {
          deleted_at: '2026-10-01T16:00:00.000Z',
          updated_at: '2026-10-01T16:00:00.000Z',
        }),
      ],
    })

    await refreshFromRemote(userId)

    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({
        deletedAt: '2026-10-01T16:00:00.000Z',
        updatedAt: '2026-10-01T16:00:00.000Z',
        syncStatus: 'synced',
      }),
    ])
  })

  it('hydrates all remote stores as synced when local data is empty', async () => {
    createRemote({
      vehicle_state: [remoteVehicle()],
      odometer_readings: [remoteOdometer()],
      fuel_entries: [remoteFuel()],
    })

    await refreshFromRemote(userId)

    await expect(getVehicleState()).resolves.toEqual({
      ...vehicleState({ updatedAt }),
      syncStatus: 'synced',
    })
    await expect(listOdometerReadings()).resolves.toEqual([
      { ...odometerReading(), syncStatus: 'synced' },
    ])
    await expect(listFuelEntries()).resolves.toEqual([
      { ...fuelEntry(), syncStatus: 'synced' },
    ])
  })

  it('hydrates saved trips and remote tombstones without resurrecting them', async () => {
    createRemote({
      saved_trips: [
        remoteTrip(),
        remoteTrip('dddddddd-dddd-4ddd-8ddd-dddddddddddd', userId, {
          deleted_at: '2026-10-01T14:00:00.000Z',
          updated_at: '2026-10-01T14:00:00.000Z',
        }),
      ],
    })

    await refreshFromRemote(userId)

    await expect(listSavedTrips()).resolves.toEqual([
      { ...savedTrip(), syncStatus: 'synced' },
    ])
    await expect(listAllSavedTrips()).resolves.toHaveLength(2)
  })

  it('syncs saved-trip edits by stable id', async () => {
    const remote = createRemote({ saved_trips: [remoteTrip()] })
    await saveSavedTrip(
      savedTrip(undefined, {
        destination: 'Trabalho',
        outboundDistanceKm: 8.4,
        returnDistanceKm: null,
        updatedAt: '2026-10-01T15:00:00.000Z',
      }),
    )

    await runSync(userId)

    expect(remote.rows.saved_trips).toEqual([
      expect.objectContaining({
        id: savedTrip().id,
        destination: 'Trabalho',
        outbound_distance_km: 8.4,
        return_distance_km: null,
      }),
    ])
  })

  it('propagates a saved-trip soft delete as an idempotent update', async () => {
    const remote = createRemote({ saved_trips: [remoteTrip()] })
    await saveSavedTrip(savedTrip())
    await softDeleteSavedTrip(savedTrip().id, '2026-10-01T16:00:00.000Z')

    await runSync(userId)

    expect(remote.rows.saved_trips).toEqual([
      expect.objectContaining({
        id: savedTrip().id,
        deleted_at: '2026-10-01T16:00:00.000Z',
      }),
    ])
    await expect(listSavedTrips()).resolves.toEqual([])
    await expect(listPending()).resolves.toEqual([])
  })

  it('preserves remote IDs during hydration', async () => {
    const readingId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const fuelId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    createRemote({
      odometer_readings: [remoteOdometer(readingId)],
      fuel_entries: [remoteFuel(fuelId)],
    })

    await refreshFromRemote(userId)

    expect((await listOdometerReadings())[0].id).toBe(readingId)
    expect((await listFuelEntries())[0].id).toBe(fuelId)
  })

  it('fetches remote records even when local data already exists', async () => {
    const remote = createRemote({ vehicle_state: [remoteVehicle()] })
    await saveOdometerReading(odometerReading())

    await refreshFromRemote(userId)

    expect(remote.selects).toHaveLength(4)
    expect(await getVehicleState()).not.toBeNull()
  })

  it('accepts an empty remote account without creating local data', async () => {
    createRemote()

    await refreshFromRemote(userId)

    await expect(getVehicleState()).resolves.toBeNull()
    await expect(listOdometerReadings()).resolves.toEqual([])
    await expect(listFuelEntries()).resolves.toEqual([])
  })

  it('does not partially hydrate when one remote read fails', async () => {
    const remote = createRemote({
      vehicle_state: [remoteVehicle()],
      odometer_readings: [remoteOdometer()],
    })
    remote.failingSelects.add('fuel_entries')

    await expect(refreshFromRemote(userId)).rejects.toThrow(
      'remote read failed',
    )
    await expect(getVehicleState()).resolves.toBeNull()
    await expect(listOdometerReadings()).resolves.toEqual([])
  })

  it('filters every hydration query by the authenticated owner', async () => {
    const remote = createRemote({
      vehicle_state: [remoteVehicle(), remoteVehicle(otherUserId)],
      odometer_readings: [remoteOdometer(), remoteOdometer(undefined, otherUserId)],
      fuel_entries: [remoteFuel(), remoteFuel(undefined, otherUserId)],
    })

    await refreshFromRemote(userId)

    expect(remote.selects).toEqual([
      { table: 'vehicle_state', column: 'user_id', value: userId },
      { table: 'odometer_readings', column: 'user_id', value: userId },
      { table: 'fuel_entries', column: 'user_id', value: userId },
      { table: 'saved_trips', column: 'user_id', value: userId },
    ])
    await expect(listOdometerReadings()).resolves.toHaveLength(1)
    await expect(listFuelEntries()).resolves.toHaveLength(1)
  })

  it('does not hydrate for an invalid user ID', async () => {
    createRemote({ vehicle_state: [remoteVehicle()] })

    await refreshFromRemote('')

    expect(supabaseStub.from).not.toHaveBeenCalled()
  })

  it('runSync pushes pending local data', async () => {
    const remote = createRemote()
    await saveVehicleState(vehicleState())

    const result = await runSync(userId)

    expect(result).toEqual({ synced: 1, pending: 0, failed: 0 })
    expect(remote.rows.vehicle_state).toHaveLength(1)
  })

  it('receives another device records on the next run without clearing local data', async () => {
    const remote = createRemote({ vehicle_state: [remoteVehicle()], fuel_entries: [remoteFuel()] })
    await runSync(userId)
    remote.rows.fuel_entries.push(remoteFuel('new-device-record'))
    await runSync(userId)
    expect(await listFuelEntries()).toHaveLength(2)
    expect(remote.upserts).toHaveLength(0)
  })

  it('does not reset an existing server vehicle when another device initializes offline', async () => {
    const remote = createRemote({ vehicle_state: [remoteVehicle()] })
    const offlineCreatedAt = '2026-10-06T20:00:00.000Z'
    await saveVehicleState(
      vehicleState({
        initialOdometerKm: 500,
        createdAt: offlineCreatedAt,
        updatedAt: offlineCreatedAt,
      }),
    )
    await runSync(userId)
    expect(remote.rows.vehicle_state[0].initial_odometer_km).toBe(1000)
    expect((await getVehicleState())?.initialOdometerKm).toBe(1000)
  })

  it('fetches every page beyond the server row limit', async () => {
    createRemote({ fuel_entries: Array.from({ length: 1001 }, (_, index) => remoteFuel(`fuel-${index}`)) })
    await runSync(userId)
    expect(await listFuelEntries()).toHaveLength(1001)
  })

  it('keeps local pending data and pulls other-device records after a write failure', async () => {
    const remote = createRemote({ fuel_entries: [remoteFuel('other-device')] })
    await saveFuelEntry(fuelEntry())
    remote.failingUpserts.add(`fuel_entries:${fuelEntry().id}`)
    expect((await runSync(userId)).pending).toBe(1)
    expect(await listFuelEntries()).toHaveLength(2)
  })

  it('runSync hydrates before checking pending records', async () => {
    createRemote({
      vehicle_state: [remoteVehicle()],
      odometer_readings: [remoteOdometer()],
    })

    const result = await runSync(userId)

    expect(result).toEqual({ synced: 0, pending: 0, failed: 0 })
    await expect(listPending()).resolves.toEqual([])
  })

  it('reuses one in-flight run for concurrent calls', async () => {
    const remote = createRemote()
    await saveVehicleState(vehicleState())
    let release = () => {}
    remote.holdUpserts(new Promise<void>((resolve) => {
      release = () => resolve()
    }))

    const first = runSync(userId)
    const second = runSync(userId)

    expect(second).toBe(first)
    release()
    await first
    expect(remote.upserts).toHaveLength(1)
  })

  it('runs another pass when a write requests sync in flight', async () => {
    const remote = createRemote()
    await saveVehicleState(vehicleState())
    let release = () => {}
    remote.holdUpserts(new Promise<void>((resolve) => {
      release = () => resolve()
    }))

    const first = runSync(userId)
    while (remote.upserts.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    await saveFuelEntry(fuelEntry())
    const second = runSync(userId)
    expect(second).toBe(first)

    release()
    await first

    expect(remote.upserts.map(({ table }) => table)).toEqual([
      'vehicle_state',
      'fuel_entries',
    ])
    await expect(listPending()).resolves.toEqual([])
  })

  it('allows a new run after the prior run completes', async () => {
    const remote = createRemote()
    await saveVehicleState(vehicleState())
    await runSync(userId)
    await saveFuelEntry(fuelEntry())

    await runSync(userId)

    expect(remote.upserts).toHaveLength(2)
  })

  it('survives closing and reopening the local database after hydration', async () => {
    createRemote({ fuel_entries: [remoteFuel()] })
    await refreshFromRemote(userId)

    await closeLocalDatabase()

    await expect(listFuelEntries()).resolves.toEqual([
      { ...fuelEntry(), syncStatus: 'synced' },
    ])
  })

  it('leaves local data available after a remote failure', async () => {
    const entry = fuelEntry()
    const remote = createRemote()
    remote.failingUpserts.add(`fuel_entries:${entry.id}`)
    await saveFuelEntry(entry)

    await syncPending(userId)

    await expect(listFuelEntries()).resolves.toEqual([
      { ...entry, syncStatus: 'pending' },
    ])
  })

  it('does not request a session while the browser is offline', async () => {
    createRemote()
    vi.stubGlobal('navigator', { onLine: false })

    await syncCurrentSessionIfOnline()

    expect(supabaseStub.getSession).not.toHaveBeenCalled()
    expect(supabaseStub.from).not.toHaveBeenCalled()
  })

  it('does not push without an authenticated session', async () => {
    createRemote()
    vi.stubGlobal('navigator', { onLine: true })
    supabaseStub.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    await saveVehicleState(vehicleState())

    await syncCurrentSessionIfOnline()

    expect(supabaseStub.from).not.toHaveBeenCalled()
    await expect(listPending()).resolves.toHaveLength(1)
  })

  it('pushes with the cached authenticated session while online', async () => {
    const remote = createRemote()
    vi.stubGlobal('navigator', { onLine: true })
    supabaseStub.getSession.mockResolvedValue({
      data: { session: { user: { id: userId } } },
      error: null,
    })
    await saveVehicleState(vehicleState())

    await syncCurrentSessionIfOnline()

    expect(remote.rows.vehicle_state).toEqual([remoteVehicle()])
  })
})


describe('vehicle model v2 sync mappings', () => {
  beforeEach(async () => {
    await resetLocalDatabase()
    supabaseStub.from.mockReset()
    supabaseStub.getSession.mockReset()
  })

  afterAll(async () => {
    await resetLocalDatabase()
  })

  it('pushes estimated fuel fields without the legacy liters column', async () => {
    const remote = createRemote()
    const entry = {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      odometerKm: 1_050.5,
      amountCents: 2_000,
      estimatedLiters: 2.837,
      referencePricePerLiter: 7.05,
      referenceWeekStart: '2026-09-20',
      referenceWeekEnd: '2026-09-26',
      fullTank: false,
      fueledAt: updatedAt,
      createdAt,
      updatedAt,
    } as unknown as FuelEntry
    await saveFuelEntry(entry)

    await syncPending(userId)

    expect(remote.upserts[0].payload).toEqual({
      id: entry.id,
      user_id: userId,
      odometer_km: 1_050.5,
      amount_cents: 2_000,
      estimated_liters: 2.837,
      reference_price_per_liter: 7.05,
      reference_week_start: '2026-09-20',
      reference_week_end: '2026-09-26',
      full_tank: false,
      fueled_at: updatedAt,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    expect(remote.upserts[0].payload).not.toHaveProperty('liters')
  })

  it('hydrates nullable estimated fuel fields without coercing null to zero', async () => {
    createRemote({
      fuel_entries: [
        {
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          user_id: userId,
          odometer_km: 1_050.5,
          amount_cents: 2_000,
          estimated_liters: null,
          reference_price_per_liter: null,
          reference_week_start: null,
          reference_week_end: null,
          full_tank: true,
          fueled_at: updatedAt,
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ],
    })

    await refreshFromRemote(userId)

    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({
        estimatedLiters: null,
        referencePricePerLiter: null,
        referenceWeekStart: null,
        referenceWeekEnd: null,
      }),
    ])
  })

  it('round-trips a nullable initial full-tank anchor', async () => {
    createRemote({
      vehicle_state: [
        {
          ...remoteVehicle(),
          initial_full_tank_at: null,
        },
      ],
    })

    await refreshFromRemote(userId)

    await expect(getVehicleState()).resolves.toEqual(
      expect.objectContaining({ initialFullTankAt: null }),
    )
  })
})
