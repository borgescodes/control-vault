import type {
  FuelEntry,
  OdometerReading,
  VehicleState,
} from '../../modules/vehicle/domain/types'
import {
  openLocalDatabase,
  VEHICLE_STATE_KEY,
  type LocalFuelEntry,
  type LocalOdometerReading,
  type LocalVehicleState,
} from './db'

export type PendingRecord =
  | {
      kind: 'vehicle_state'
      id: typeof VEHICLE_STATE_KEY
      record: LocalVehicleState
    }
  | {
      kind: 'odometer_readings'
      id: string
      record: LocalOdometerReading
    }
  | {
      kind: 'fuel_entries'
      id: string
      record: LocalFuelEntry
    }

const pending = { syncStatus: 'pending' as const }
const synced = { syncStatus: 'synced' as const }

type LocalChange = 'write' | 'refresh'
const listeners = new Set<(change: LocalChange) => void>()

export function subscribeToLocalChanges(listener: (change: LocalChange) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function notifyLocalChanges(change: LocalChange) {
  for (const listener of listeners) listener(change)
}

export async function claimSyncOwner(userId: string): Promise<void> {
  const database = await openLocalDatabase()
  const transaction = database.transaction('sync_metadata', 'readwrite')
  const owner = await transaction.store.get('owner')
  if (owner && owner !== userId) {
    await transaction.done
    throw new Error('Dados locais pertencem a outra conta. Entre com a conta original.')
  }
  if (!owner) await transaction.store.put(userId, 'owner')
  await transaction.done
}

export type HydratedVehicleData = {
  vehicleState: VehicleState | null
  odometerReadings: OdometerReading[]
  fuelEntries: FuelEntry[]
}

export async function saveVehicleState(state: VehicleState): Promise<void> {
  const database = await openLocalDatabase()
  await database.put(
    'vehicle_state',
    { ...state, ...pending },
    VEHICLE_STATE_KEY,
  )
  notifyLocalChanges('write')
}

export async function getVehicleState(): Promise<LocalVehicleState | null> {
  const database = await openLocalDatabase()
  return (await database.get('vehicle_state', VEHICLE_STATE_KEY)) ?? null
}

export async function saveOdometerReading(
  reading: OdometerReading,
): Promise<void> {
  const database = await openLocalDatabase()
  await database.put('odometer_readings', { ...reading, ...pending })
  notifyLocalChanges('write')
}

export async function saveOdometerReadingIfCurrent(
  reading: OdometerReading,
  shouldSave: (latestOdometerKm: number | null) => boolean,
): Promise<boolean> {
  const database = await openLocalDatabase()
  const transaction = database.transaction('odometer_readings', 'readwrite')
  const store = transaction.objectStore('odometer_readings')
  const readings = await store.getAll()
  const latestOdometerKm = readings.length
    ? Math.max(...readings.map(({ readingKm }) => readingKm))
    : null

  if (!shouldSave(latestOdometerKm)) {
    await transaction.done
    return false
  }

  await store.put({ ...reading, ...pending })
  await transaction.done
  notifyLocalChanges('write')
  return true
}

export async function listOdometerReadings(): Promise<
  LocalOdometerReading[]
> {
  const database = await openLocalDatabase()
  return database.getAll('odometer_readings')
}

export async function saveFuelEntry(entry: FuelEntry): Promise<void> {
  const database = await openLocalDatabase()
  await database.put('fuel_entries', { ...entry, ...pending })
  notifyLocalChanges('write')
}

export async function listFuelEntries(): Promise<LocalFuelEntry[]> {
  const database = await openLocalDatabase()
  return database.getAll('fuel_entries')
}

export async function initializeLocalVehicle(
  state: VehicleState,
  reading: OdometerReading,
): Promise<void> {
  const database = await openLocalDatabase()
  const transaction = database.transaction(
    ['vehicle_state', 'odometer_readings'],
    'readwrite',
  )
  const writes: Promise<unknown>[] = []

  try {
    writes.push(
      transaction.objectStore('vehicle_state').put(
        { ...state, ...pending },
        VEHICLE_STATE_KEY,
      ),
    )
    writes.push(
      transaction
        .objectStore('odometer_readings')
        .put({ ...reading, ...pending }),
    )

    await Promise.all(writes)
    await transaction.done
    notifyLocalChanges('write')
  } catch (error) {
    try {
      transaction.abort()
    } catch {
      // A failed IndexedDB request may already have aborted the transaction.
    }
    await Promise.allSettled(writes)
    await transaction.done.catch(() => undefined)
    throw error
  }
}

export async function saveFuelAndReading(
  entry: FuelEntry,
  reading: OdometerReading,
): Promise<void> {
  const database = await openLocalDatabase()
  const transaction = database.transaction(
    ['fuel_entries', 'odometer_readings'],
    'readwrite',
  )
  const writes: Promise<unknown>[] = []

  try {
    writes.push(
      transaction
        .objectStore('fuel_entries')
        .put({ ...entry, ...pending }),
    )
    writes.push(
      transaction
        .objectStore('odometer_readings')
        .put({ ...reading, ...pending }),
    )

    await Promise.all(writes)
    await transaction.done
    notifyLocalChanges('write')
  } catch (error) {
    try {
      transaction.abort()
    } catch {
      // A failed IndexedDB request may already have aborted the transaction.
    }
    await Promise.allSettled(writes)
    await transaction.done.catch(() => undefined)
    throw error
  }
}

export async function saveFuelAndReadingIfCurrent(
  entry: FuelEntry,
  reading: OdometerReading,
  shouldSave: (latestOdometerKm: number | null) => boolean,
): Promise<boolean> {
  const database = await openLocalDatabase()
  const transaction = database.transaction(
    ['fuel_entries', 'odometer_readings'],
    'readwrite',
  )
  const readingStore = transaction.objectStore('odometer_readings')
  const readings = await readingStore.getAll()
  const latestOdometerKm = readings.length
    ? Math.max(...readings.map(({ readingKm }) => readingKm))
    : null

  if (!shouldSave(latestOdometerKm)) {
    await transaction.done
    return false
  }

  const writes: Promise<unknown>[] = []

  try {
    writes.push(
      transaction
        .objectStore('fuel_entries')
        .put({ ...entry, ...pending }),
    )
    writes.push(readingStore.put({ ...reading, ...pending }))
    await Promise.all(writes)
    await transaction.done
    notifyLocalChanges('write')
    return true
  } catch (error) {
    try {
      transaction.abort()
    } catch {
      // A failed IndexedDB request may already have aborted the transaction.
    }
    await Promise.allSettled(writes)
    await transaction.done.catch(() => undefined)
    throw error
  }
}

export async function listPending(): Promise<PendingRecord[]> {
  const [state, readings, entries] = await Promise.all([
    getVehicleState(),
    listOdometerReadings(),
    listFuelEntries(),
  ])
  const records: PendingRecord[] = []

  if (state?.syncStatus === 'pending') {
    records.push({
      kind: 'vehicle_state',
      id: VEHICLE_STATE_KEY,
      record: state,
    })
  }

  for (const reading of readings) {
    if (reading.syncStatus === 'pending') {
      records.push({
        kind: 'odometer_readings',
        id: reading.id,
        record: reading,
      })
    }
  }

  for (const entry of entries) {
    if (entry.syncStatus === 'pending') {
      records.push({
        kind: 'fuel_entries',
        id: entry.id,
        record: entry,
      })
    }
  }

  return records
}

export async function markSynced(
  kind: PendingRecord['kind'],
  id: string,
  expectedRecord?: PendingRecord['record'],
): Promise<void> {
  const database = await openLocalDatabase()
  if (kind === 'vehicle_state' && id !== VEHICLE_STATE_KEY) return
  const transaction = database.transaction(kind, 'readwrite')
  const store = transaction.objectStore(kind)
  const record = await store.get(id)
  if (record && (!expectedRecord || Object.entries(expectedRecord).every(
    ([key, value]) => Object.is(value, (record as unknown as Record<string, unknown>)[key]),
  ))) {
    await store.put({ ...record, ...synced }, kind === 'vehicle_state' ? VEHICLE_STATE_KEY : undefined)
  }
  await transaction.done
  notifyLocalChanges('refresh')
}

export async function isLocalDatabaseEmpty(): Promise<boolean> {
  const database = await openLocalDatabase()
  const transaction = database.transaction(
    ['vehicle_state', 'odometer_readings', 'fuel_entries'],
    'readonly',
  )
  const counts = await Promise.all([
    transaction.objectStore('vehicle_state').count(),
    transaction.objectStore('odometer_readings').count(),
    transaction.objectStore('fuel_entries').count(),
  ])
  await transaction.done

  return counts.every((count) => count === 0)
}

export async function saveHydratedVehicleData(
  data: HydratedVehicleData,
): Promise<void> {
  const database = await openLocalDatabase()
  const transaction = database.transaction(
    ['vehicle_state', 'odometer_readings', 'fuel_entries'],
    'readwrite',
  )
  const writes: Promise<unknown>[] = []

  if (data.vehicleState) {
    writes.push(
      transaction.objectStore('vehicle_state').put(
        { ...data.vehicleState, ...synced },
        VEHICLE_STATE_KEY,
      ),
    )
  }

  writes.push(
    ...data.odometerReadings.map((reading) =>
      transaction
        .objectStore('odometer_readings')
        .put({ ...reading, ...synced }),
    ),
    ...data.fuelEntries.map((entry) =>
      transaction.objectStore('fuel_entries').put({ ...entry, ...synced }),
    ),
  )
  await Promise.all(writes)
  await transaction.done
  notifyLocalChanges('refresh')
}

export async function mergeRemoteVehicleData(data: HydratedVehicleData): Promise<void> {
  const database = await openLocalDatabase()
  const transaction = database.transaction(
    ['vehicle_state', 'odometer_readings', 'fuel_entries'], 'readwrite',
  )
  const stateStore = transaction.objectStore('vehicle_state')
  if (data.vehicleState && (await stateStore.get(VEHICLE_STATE_KEY))?.syncStatus !== 'pending') {
    await stateStore.put({ ...data.vehicleState, ...synced }, VEHICLE_STATE_KEY)
  }
  const readingStore = transaction.objectStore('odometer_readings')
  for (const reading of data.odometerReadings) {
    if ((await readingStore.get(reading.id))?.syncStatus !== 'pending') {
      await readingStore.put({ ...reading, ...synced })
    }
  }
  const fuelStore = transaction.objectStore('fuel_entries')
  for (const entry of data.fuelEntries) {
    if ((await fuelStore.get(entry.id))?.syncStatus !== 'pending') {
      await fuelStore.put({ ...entry, ...synced })
    }
  }
  await transaction.done
  notifyLocalChanges('refresh')
}
