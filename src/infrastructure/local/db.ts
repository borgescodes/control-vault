import {
  deleteDB,
  openDB,
  type DBSchema,
  type IDBPDatabase,
} from 'idb'

import type {
  FuelEntry,
  OdometerReading,
  VehicleState,
} from '../../modules/vehicle/domain/types'

export const LOCAL_DATABASE_NAME = 'control-vault'
export const LOCAL_DATABASE_VERSION = 2
export const VEHICLE_STATE_KEY = 'primary'

export type SyncStatus = 'pending' | 'synced'

export type LocalVehicleState = VehicleState & { syncStatus: SyncStatus }
export type LocalOdometerReading = OdometerReading & { syncStatus: SyncStatus }
export type LocalFuelEntry = FuelEntry & { syncStatus: SyncStatus }

export interface ControlVaultDatabase extends DBSchema {
  vehicle_state: {
    key: typeof VEHICLE_STATE_KEY
    value: LocalVehicleState
  }
  odometer_readings: {
    key: string
    value: LocalOdometerReading
  }
  fuel_entries: {
    key: string
    value: LocalFuelEntry
  }
}

let databasePromise: Promise<IDBPDatabase<ControlVaultDatabase>> | undefined

export function openLocalDatabase(): Promise<IDBPDatabase<ControlVaultDatabase>> {
  databasePromise ??= openDB<ControlVaultDatabase>(
    LOCAL_DATABASE_NAME,
    LOCAL_DATABASE_VERSION,
    {
      upgrade(database, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          database.createObjectStore('vehicle_state')
          database.createObjectStore('odometer_readings', { keyPath: 'id' })
          database.createObjectStore('fuel_entries', { keyPath: 'id' })
        }

        if (oldVersion === 1) {
          const stateStore = transaction.objectStore('vehicle_state')
          void stateStore.get(VEHICLE_STATE_KEY).then((stored) => {
            const legacy = stored as unknown as Record<string, unknown> | undefined
            if (!legacy || !('tankCapacityLiters' in legacy)) return

            const {
              tankCapacityLiters,
              ...rest
            } = legacy

            return stateStore.put(
              {
                ...rest,
                nominalTankCapacityLiters: tankCapacityLiters,
              } as unknown as LocalVehicleState,
              VEHICLE_STATE_KEY,
            )
          })

          const fuelStore = transaction.objectStore('fuel_entries')
          void fuelStore.getAll().then((storedEntries) =>
            Promise.all(
              storedEntries.map((stored) => {
                const legacy = stored as unknown as Record<string, unknown>
                if (!('liters' in legacy)) return undefined

                const {
                  liters,
                  ...rest
                } = legacy
                return fuelStore.put({
                  ...rest,
                  estimatedLiters: liters,
                  referencePricePerLiter: null,
                  referenceWeekStart: null,
                  referenceWeekEnd: null,
                } as unknown as LocalFuelEntry)
              }),
            ),
          )
        }
      },
    },
  )

  return databasePromise
}

export async function closeLocalDatabase(): Promise<void> {
  if (!databasePromise) {
    return
  }

  const database = await databasePromise
  database.close()
  databasePromise = undefined
}

export async function resetLocalDatabase(): Promise<void> {
  await closeLocalDatabase()
  await deleteDB(LOCAL_DATABASE_NAME)
}
