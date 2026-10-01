import { saveSavedTrip, softDeleteSavedTrip } from '../../infrastructure/local/store'
import { syncCurrentSessionIfOnline } from '../../infrastructure/sync/sync'
import { createUuid } from '../../shared/uuid'
import type { SavedTrip } from './domain/types'

export type SavedTripInput = {
  origin: string
  destination: string
  outboundDistanceKm: number
  returnDistanceKm: number | null
}

export type SavedTripSaveResult =
  | { kind: 'saved'; trip: SavedTrip }
  | { kind: 'invalid'; reason: string }

const MAX_LABEL_LENGTH = 80
const MAX_DISTANCE_KM = 999_999

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeDistance(value: number): number {
  return Math.round(value * 10) / 10
}

function validateInput(input: SavedTripInput):
  | { origin: string; destination: string; outboundDistanceKm: number; returnDistanceKm: number | null }
  | null {
  const origin = normalizeLabel(input.origin)
  const destination = normalizeLabel(input.destination)

  if (
    origin.length === 0 ||
    destination.length === 0 ||
    origin.length > MAX_LABEL_LENGTH ||
    destination.length > MAX_LABEL_LENGTH
  ) {
    return null
  }

  if (
    !Number.isFinite(input.outboundDistanceKm) ||
    input.outboundDistanceKm <= 0 ||
    input.outboundDistanceKm > MAX_DISTANCE_KM
  ) {
    return null
  }

  if (
    input.returnDistanceKm !== null &&
    (!Number.isFinite(input.returnDistanceKm) ||
      input.returnDistanceKm <= 0 ||
      input.returnDistanceKm > MAX_DISTANCE_KM)
  ) {
    return null
  }

  return {
    origin,
    destination,
    outboundDistanceKm: normalizeDistance(input.outboundDistanceKm),
    returnDistanceKm:
      input.returnDistanceKm === null
        ? null
        : normalizeDistance(input.returnDistanceKm),
  }
}

function queueSync() {
  void syncCurrentSessionIfOnline().catch(() => undefined)
}

export async function createSavedTrip(
  input: SavedTripInput,
  now: string,
): Promise<SavedTripSaveResult> {
  const normalized = validateInput(input)
  if (!normalized) return { kind: 'invalid', reason: 'Dados do percurso inválidos' }
  if (!validTimestamp(now)) return { kind: 'invalid', reason: 'Data inválida' }

  const trip: SavedTrip = {
    id: createUuid(),
    ...normalized,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  await saveSavedTrip(trip)
  queueSync()
  return { kind: 'saved', trip }
}

export async function updateSavedTrip(
  existing: SavedTrip,
  input: SavedTripInput,
  now: string,
): Promise<SavedTripSaveResult> {
  const normalized = validateInput(input)
  if (!normalized) return { kind: 'invalid', reason: 'Dados do percurso inválidos' }
  if (!validTimestamp(now)) return { kind: 'invalid', reason: 'Data inválida' }

  const trip: SavedTrip = {
    ...existing,
    ...normalized,
    deletedAt: null,
    updatedAt: now,
  }

  await saveSavedTrip(trip)
  queueSync()
  return { kind: 'saved', trip }
}

export async function deleteSavedTrip(
  id: string,
  now: string,
): Promise<boolean> {
  if (!validTimestamp(now)) throw new RangeError('Data inválida')
  const deleted = await softDeleteSavedTrip(id, now)
  if (deleted) queueSync()
  return deleted
}
