import type {
  FuelEntry,
  OdometerReading,
  VehicleState,
} from '../../modules/vehicle/domain/types'
import {
  isLocalDatabaseEmpty,
  listPending,
  markSynced,
  saveHydratedVehicleData,
  type PendingRecord,
} from '../local/store'
import { supabase } from '../supabase/client'

export type SyncResult = {
  synced: number
  pending: number
  failed: number
}

type RemoteVehicleState = {
  user_id: string
  tank_capacity_liters: number
  initial_odometer_km: number
  initial_full_tank_at: string | null
  created_at: string
  updated_at: string
}

type RemoteOdometerReading = {
  id: string
  user_id: string
  reading_km: number
  recorded_at: string
  source: OdometerReading['source']
  created_at: string
  updated_at: string
}

type RemoteFuelEntry = {
  id: string
  user_id: string
  odometer_km: number
  amount_cents: number
  estimated_liters: number | null
  reference_price_per_liter: number | null
  reference_week_start: string | null
  reference_week_end: string | null
  full_tank: boolean
  fueled_at: string
  created_at: string
  updated_at: string
}

function hasUserId(userId: string): boolean {
  return userId.trim().length > 0
}

function toRemoteVehicleState(
  record: PendingRecord & { kind: 'vehicle_state' },
  userId: string,
): RemoteVehicleState {
  return {
    user_id: userId,
    tank_capacity_liters: record.record.nominalTankCapacityLiters,
    initial_odometer_km: record.record.initialOdometerKm,
    initial_full_tank_at: record.record.initialFullTankAt,
    created_at: record.record.createdAt,
    updated_at: record.record.updatedAt,
  }
}

function toRemoteOdometerReading(
  record: PendingRecord & { kind: 'odometer_readings' },
  userId: string,
): RemoteOdometerReading {
  return {
    id: record.record.id,
    user_id: userId,
    reading_km: record.record.readingKm,
    recorded_at: record.record.recordedAt,
    source: record.record.source,
    created_at: record.record.createdAt,
    updated_at: record.record.updatedAt,
  }
}

function toRemoteFuelEntry(
  record: PendingRecord & { kind: 'fuel_entries' },
  userId: string,
): RemoteFuelEntry {
  return {
    id: record.record.id,
    user_id: userId,
    odometer_km: record.record.odometerKm,
    amount_cents: record.record.amountCents,
    estimated_liters: record.record.estimatedLiters,
    reference_price_per_liter: record.record.referencePricePerLiter,
    reference_week_start: record.record.referenceWeekStart,
    reference_week_end: record.record.referenceWeekEnd,
    full_tank: record.record.fullTank,
    fueled_at: record.record.fueledAt,
    created_at: record.record.createdAt,
    updated_at: record.record.updatedAt,
  }
}

async function pushRecord(record: PendingRecord, userId: string) {
  if (record.kind === 'vehicle_state') {
    return supabase
      .from('vehicle_state')
      .upsert(toRemoteVehicleState(record, userId), { onConflict: 'user_id' })
  }

  if (record.kind === 'odometer_readings') {
    return supabase
      .from('odometer_readings')
      .upsert(toRemoteOdometerReading(record, userId), { onConflict: 'id' })
  }

  return supabase
    .from('fuel_entries')
    .upsert(toRemoteFuelEntry(record, userId), { onConflict: 'id' })
}

export async function syncPending(userId: string): Promise<SyncResult> {
  const records = await listPending()

  if (!hasUserId(userId)) {
    return { synced: 0, pending: records.length, failed: 0 }
  }

  let synced = 0
  let failed = 0

  for (const record of records) {
    try {
      const { error } = await pushRecord(record, userId)
      if (error) {
        failed += 1
        continue
      }

      await markSynced(record.kind, record.id)
      synced += 1
    } catch {
      failed += 1
    }
  }

  return {
    synced,
    pending: (await listPending()).length,
    failed,
  }
}

function fromRemoteVehicleState(row: RemoteVehicleState): VehicleState {
  return {
    nominalTankCapacityLiters: Number(row.tank_capacity_liters),
    initialOdometerKm: Number(row.initial_odometer_km),
    initialFullTankAt: row.initial_full_tank_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function fromRemoteOdometerReading(row: RemoteOdometerReading): OdometerReading {
  return {
    id: row.id,
    readingKm: Number(row.reading_km),
    recordedAt: row.recorded_at,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function nullableNumber(value: number | null): number | null {
  return value === null ? null : Number(value)
}

function fromRemoteFuelEntry(row: RemoteFuelEntry): FuelEntry {
  return {
    id: row.id,
    odometerKm: Number(row.odometer_km),
    amountCents: Number(row.amount_cents),
    estimatedLiters: nullableNumber(row.estimated_liters),
    referencePricePerLiter: nullableNumber(row.reference_price_per_liter),
    referenceWeekStart: row.reference_week_start,
    referenceWeekEnd: row.reference_week_end,
    fullTank: row.full_tank,
    fueledAt: row.fueled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function readOwnedRows(
  table: 'vehicle_state',
  userId: string,
): Promise<RemoteVehicleState[]>
async function readOwnedRows(
  table: 'odometer_readings',
  userId: string,
): Promise<RemoteOdometerReading[]>
async function readOwnedRows(
  table: 'fuel_entries',
  userId: string,
): Promise<RemoteFuelEntry[]>
async function readOwnedRows(table: string, userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return data ?? []
}

export async function hydrateFromRemoteIfLocalEmpty(
  userId: string,
): Promise<void> {
  if (!hasUserId(userId) || !(await isLocalDatabaseEmpty())) {
    return
  }

  const [vehicleRows, odometerRows, fuelRows] = await Promise.all([
    readOwnedRows('vehicle_state', userId),
    readOwnedRows('odometer_readings', userId),
    readOwnedRows('fuel_entries', userId),
  ])

  await saveHydratedVehicleData({
    vehicleState: vehicleRows[0]
      ? fromRemoteVehicleState(vehicleRows[0])
      : null,
    odometerReadings: odometerRows.map(fromRemoteOdometerReading),
    fuelEntries: fuelRows.map(fromRemoteFuelEntry),
  })
}

let inFlight: Promise<SyncResult> | null = null
let rerunRequested = false

export function runSync(userId: string): Promise<SyncResult> {
  if (inFlight) {
    rerunRequested = true
    return inFlight
  }

  const current = (async () => {
    const total: SyncResult = { synced: 0, pending: 0, failed: 0 }
    do {
      rerunRequested = false
      await hydrateFromRemoteIfLocalEmpty(userId)
      const pass = await syncPending(userId)
      total.synced += pass.synced
      total.pending = pass.pending
      total.failed += pass.failed
    } while (rerunRequested)
    return total
  })()
  inFlight = current
  void current.then(
    () => {
      if (inFlight === current) inFlight = null
    },
    () => {
      if (inFlight === current) inFlight = null
    },
  )
  return current
}

export async function syncCurrentSessionIfOnline(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    return
  }

  const { data, error } = await supabase.auth.getSession()
  const currentUserId = data.session?.user.id
  if (error || !currentUserId) {
    return
  }

  await runSync(currentUserId)
}
