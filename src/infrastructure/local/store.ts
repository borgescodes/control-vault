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
): Promise<void> {
  const database = await openLocalDatabase()

  if (kind === 'vehicle_state') {
    if (id !== VEHICLE_STATE_KEY) {
      return
    }
    const state = await database.get('vehicle_state', VEHICLE_STATE_KEY)
    if (state) {
      await database.put(
        'vehicle_state',
        { ...state, syncStatus: 'synced' },
        VEHICLE_STATE_KEY,
      )
    }
    return
  }

  if (kind === 'odometer_readings') {
    const reading = await database.get('odometer_readings', id)
    if (reading) {
      await database.put('odometer_readings', {
        ...reading,
        syncStatus: 'synced',
      })
    }
    return
  }

  const entry = await database.get('fuel_entries', id)
  if (entry) {
    await database.put('fuel_entries', {
      ...entry,
      syncStatus: 'synced',
    })
  }
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
}
