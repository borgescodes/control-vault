import {
  initializeLocalVehicle,
  listOdometerReadings,
  saveFuelAndReading,
  saveOdometerReading,
} from '../../infrastructure/local/store'
import { TANK_CAPACITY_LITERS } from './domain/config'
import { validateOdometer } from './domain/odometer'
import type { FuelEntry, OdometerReading, VehicleState } from './domain/types'

export type RecordResult =
  | { kind: 'saved' }
  | { kind: 'requires_confirmation'; deltaKm: number }
  | { kind: 'invalid'; reason: string }

export type FuelInput = {
  odometerKm: number
  amountCents: number
  liters: number
  fullTank: boolean
  fueledAt: string
}

function hasValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

async function getLatestOdometerKm(): Promise<number | null> {
  const readings = await listOdometerReadings()

  if (readings.length === 0) {
    return null
  }

  return Math.max(...readings.map(({ readingKm }) => readingKm))
}

export async function initializeVehicle(
  initialOdometerKm: number,
  now: string,
): Promise<void> {
  if (!Number.isFinite(initialOdometerKm) || initialOdometerKm < 0) {
    throw new RangeError('Hodômetro inválido')
  }

  if (!hasValidTimestamp(now)) {
    throw new RangeError('Data inválida')
  }

  const state: VehicleState = {
    tankCapacityLiters: TANK_CAPACITY_LITERS,
    initialOdometerKm,
    initialFullTankAt: now,
    createdAt: now,
    updatedAt: now,
  }
  const reading: OdometerReading = {
    id: crypto.randomUUID(),
    readingKm: initialOdometerKm,
    recordedAt: now,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }

  await initializeLocalVehicle(state, reading)
}

export async function recordOdometer(
  readingKm: number,
  recordedAt: string,
  confirmSuspicious = false,
): Promise<RecordResult> {
  if (!Number.isFinite(readingKm) || readingKm < 0) {
    return { kind: 'invalid', reason: 'Hodômetro inválido' }
  }

  if (!hasValidTimestamp(recordedAt)) {
    return { kind: 'invalid', reason: 'Data inválida' }
  }

  const validation = validateOdometer(await getLatestOdometerKm(), readingKm)

  if (validation.kind === 'invalid') {
    return { kind: 'invalid', reason: 'Hodômetro menor que o atual' }
  }

  if (validation.kind === 'suspicious' && !confirmSuspicious) {
    return {
      kind: 'requires_confirmation',
      deltaKm: validation.deltaKm,
    }
  }

  await saveOdometerReading({
    id: crypto.randomUUID(),
    readingKm,
    recordedAt,
    source: 'manual',
    createdAt: recordedAt,
    updatedAt: recordedAt,
  })

  return { kind: 'saved' }
}

export async function recordFuel(
  input: FuelInput,
  confirmSuspicious = false,
): Promise<RecordResult> {
  if (!Number.isFinite(input.odometerKm) || input.odometerKm < 0) {
    return { kind: 'invalid', reason: 'Hodômetro inválido' }
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { kind: 'invalid', reason: 'Valor inválido' }
  }

  if (!Number.isFinite(input.liters) || input.liters <= 0) {
    return { kind: 'invalid', reason: 'Litros inválidos' }
  }

  if (!hasValidTimestamp(input.fueledAt)) {
    return { kind: 'invalid', reason: 'Data inválida' }
  }

  const validation = validateOdometer(
    await getLatestOdometerKm(),
    input.odometerKm,
  )

  if (validation.kind === 'invalid') {
    return { kind: 'invalid', reason: 'Hodômetro menor que o atual' }
  }

  if (validation.kind === 'suspicious' && !confirmSuspicious) {
    return {
      kind: 'requires_confirmation',
      deltaKm: validation.deltaKm,
    }
  }

  const entry: FuelEntry = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: input.fueledAt,
    updatedAt: input.fueledAt,
  }
  const reading: OdometerReading = {
    id: crypto.randomUUID(),
    readingKm: input.odometerKm,
    recordedAt: input.fueledAt,
    source: 'fuel_entry',
    createdAt: input.fueledAt,
    updatedAt: input.fueledAt,
  }

  await saveFuelAndReading(entry, reading)

  return { kind: 'saved' }
}
