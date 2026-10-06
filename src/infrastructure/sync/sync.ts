import type {
  FuelEntry,
  OdometerReading,
  SavedTrip,
  VehicleState,
} from '../../modules/vehicle/domain/types'
import {
  claimSyncOwner,
  listPending,
  markSynced,
  mergeRemoteVehicleData,
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

type RemoteSavedTrip = {
  id: string
  user_id: string
  origin: string
  destination: string
  outbound_distance_km: number
  return_distance_km: number | null
  deleted_at: string | null
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
  deleted_at: string | null
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

function toRemoteSavedTrip(
  record: PendingRecord & { kind: 'saved_trips' },
  userId: string,
): RemoteSavedTrip {
  return {
    id: record.record.id,
    user_id: userId,
    origin: record.record.origin,
    destination: record.record.destination,
    outbound_distance_km: record.record.outboundDistanceKm,
    return_distance_km: record.record.returnDistanceKm,
    deleted_at: record.record.deletedAt,
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
    deleted_at: record.record.deletedAt,
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

  if (record.kind === 'fuel_entries') {
    return supabase
      .from('fuel_entries')
      .upsert(toRemoteFuelEntry(record, userId), { onConflict: 'id' })
  }

  return supabase
    .from('saved_trips')
    .upsert(toRemoteSavedTrip(record, userId), { onConflict: 'id' })
}

export async function syncPending(userId: string): Promise<SyncResult> {
  const records = await listPending()

  if (!hasUserId(userId)) {
    return { synced: 0, pending: records.length, failed: 0 }
  }
  await claimSyncOwner(userId)

  let synced = 0
  let failed = 0

  for (const record of records) {
    try {
      const { error } = await pushRecord(record, userId)
      if (error) {
        logSyncFailure(record.kind, error)
        failed += 1
        continue
      }

      await markSynced(record.kind, record.id, record.record)
      synced += 1
    } catch (error) {
      logSyncFailure(record.kind, error)
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

function fromRemoteSavedTrip(row: RemoteSavedTrip): SavedTrip {
  return {
    id: row.id,
    origin: row.origin,
    destination: row.destination,
    outboundDistanceKm: Number(row.outbound_distance_km),
    returnDistanceKm: nullableNumber(row.return_distance_km),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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
    deletedAt: row.deleted_at,
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
async function readOwnedRows(
  table: 'saved_trips',
  userId: string,
): Promise<RemoteSavedTrip[]>
async function readOwnedRows(table: string, userId: string): Promise<unknown[]> {
  const rows: unknown[] = []
  const pageSize = 1000
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase.from(table).select('*')
      .eq('user_id', userId).order(table === 'vehicle_state' ? 'user_id' : 'id')
      .range(start, start + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

export async function refreshFromRemote(
  userId: string,
): Promise<void> {
  if (!hasUserId(userId)) {
    return
  }
  await claimSyncOwner(userId)

  const [vehicleRows, odometerRows, fuelRows, tripRows] = await Promise.all([
    readOwnedRows('vehicle_state', userId),
    readOwnedRows('odometer_readings', userId),
    readOwnedRows('fuel_entries', userId),
    readOwnedRows('saved_trips', userId),
  ])

  await mergeRemoteVehicleData({
    vehicleState: vehicleRows[0]
      ? fromRemoteVehicleState(vehicleRows[0])
      : null,
    odometerReadings: odometerRows.map(fromRemoteOdometerReading),
    fuelEntries: fuelRows.map(fromRemoteFuelEntry),
    savedTrips: tripRows.map(fromRemoteSavedTrip),
  })
}

export type SyncActivity = 'unconfirmed' | 'idle' | 'syncing' | 'pending' | 'error'

let lastActivity: SyncActivity = 'unconfirmed'

function logSyncFailure(operation: string, error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'network_or_storage'
  console.warn('[Control Vault sync]', { operation, code })
}

const syncActivityListeners = new Set<(activity: SyncActivity) => void>()

function emitSyncActivity(activity: SyncActivity) {
  lastActivity = activity
  for (const listener of syncActivityListeners) listener(activity)
}

export function subscribeToSyncActivity(
  listener: (activity: SyncActivity) => void,
): () => void {
  syncActivityListeners.add(listener)
  listener(lastActivity)
  return () => syncActivityListeners.delete(listener)
}

let inFlight: Promise<SyncResult> | null = null
let rerunRequested = false
let inFlightUserId: string | null = null

export function runSync(userId: string): Promise<SyncResult> {
  if (inFlight) {
    if (inFlightUserId !== userId) return Promise.reject(new Error('Sincronização de outra conta em andamento'))
    rerunRequested = true
    return inFlight
  }

  inFlightUserId = userId
  emitSyncActivity('syncing')

  const current = (async () => {
    const total: SyncResult = { synced: 0, pending: 0, failed: 0 }
    do {
      rerunRequested = false
      const pass = await syncPending(userId)
      await refreshFromRemote(userId)
      total.synced += pass.synced
      total.pending = (await listPending()).length
      total.failed += pass.failed
    } while (rerunRequested)
    return total
  })()
  inFlight = current
  void current.then(
    (result) => {
      if (inFlight === current) {
        inFlight = null
        inFlightUserId = null
        emitSyncActivity(result.failed > 0 ? 'error' : result.pending > 0 ? 'pending' : hasUserId(userId) ? 'idle' : 'unconfirmed')
      }
    },
    (error) => {
      if (inFlight === current) {
        inFlight = null
        inFlightUserId = null
        logSyncFailure('refresh', error)
        emitSyncActivity('error')
      }
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
    emitSyncActivity('unconfirmed')
    if (error) logSyncFailure('session', error)
    return
  }

  await runSync(currentUserId)
}
