import { getFuelPriceReference } from '../../infrastructure/fuelPrice/fuelPrice'
import {
  initializeLocalVehicle,
  saveFuelAndReadingIfCurrent,
  saveOdometerReadingIfCurrent,
} from '../../infrastructure/local/store'
import { syncCurrentSessionIfOnline } from '../../infrastructure/sync/sync'
import { NOMINAL_TANK_CAPACITY_LITERS } from './domain/config'
import { validateOdometer } from './domain/odometer'
import type { FuelEntry, OdometerReading, VehicleState } from './domain/types'

export type RecordResult =
  | { kind: 'saved' }
  | { kind: 'requires_confirmation'; deltaKm: number }
  | { kind: 'invalid'; reason: string }

export type FuelInput = {
  odometerKm: number
  amountCents: number
  fullTank: boolean
  fueledAt: string
}

function hasValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function roundLiters(value: number): number {
  return Math.round(value * 1000) / 1000
}

export async function initializeVehicle(
  initialOdometerKm: number,
  initialFullTank: boolean,
  now: string,
): Promise<void> {
  if (!Number.isFinite(initialOdometerKm) || initialOdometerKm < 0) {
    throw new RangeError('Hodômetro inválido')
  }

  if (!hasValidTimestamp(now)) {
    throw new RangeError('Data inválida')
  }

  const state: VehicleState = {
    nominalTankCapacityLiters: NOMINAL_TANK_CAPACITY_LITERS,
    initialOdometerKm,
    initialFullTankAt: initialFullTank ? now : null,
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
  void syncCurrentSessionIfOnline().catch(() => undefined)
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

  const reading: OdometerReading = {
    id: crypto.randomUUID(),
    readingKm,
    recordedAt,
    source: 'manual',
    createdAt: recordedAt,
    updatedAt: recordedAt,
  }
  let validation: ReturnType<typeof validateOdometer> | undefined
  const saved = await saveOdometerReadingIfCurrent(reading, (latest) => {
    validation = validateOdometer(latest, readingKm)
    return (
      validation.kind === 'valid' ||
      (validation.kind === 'suspicious' && confirmSuspicious)
    )
  })

  if (!saved) {
    if (validation?.kind === 'suspicious') {
      return {
        kind: 'requires_confirmation',
        deltaKm: validation.deltaKm,
      }
    }
    return { kind: 'invalid', reason: 'Hodômetro menor que o atual' }
  }
  void syncCurrentSessionIfOnline().catch(() => undefined)

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

  if (!hasValidTimestamp(input.fueledAt)) {
    return { kind: 'invalid', reason: 'Data inválida' }
  }

  let reference: Awaited<ReturnType<typeof getFuelPriceReference>> = null
  try {
    reference = await getFuelPriceReference(new Date(input.fueledAt))
  } catch {
    reference = null
  }

  const estimatedLiters = reference
    ? roundLiters((input.amountCents / 100) / reference.precoMedio)
    : null

  const entry: FuelEntry = {
    id: crypto.randomUUID(),
    odometerKm: input.odometerKm,
    amountCents: input.amountCents,
    estimatedLiters,
    referencePricePerLiter: reference?.precoMedio ?? null,
    referenceWeekStart: reference?.semanaInicio ?? null,
    referenceWeekEnd: reference?.semanaFim ?? null,
    fullTank: input.fullTank,
    fueledAt: input.fueledAt,
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

  let validation: ReturnType<typeof validateOdometer> | undefined
  const saved = await saveFuelAndReadingIfCurrent(
    entry,
    reading,
    (latest) => {
      validation = validateOdometer(latest, input.odometerKm)
      return (
        validation.kind === 'valid' ||
        (validation.kind === 'suspicious' && confirmSuspicious)
      )
    },
  )

  if (!saved) {
    if (validation?.kind === 'suspicious') {
      return {
        kind: 'requires_confirmation',
        deltaKm: validation.deltaKm,
      }
    }
    return { kind: 'invalid', reason: 'Hodômetro menor que o atual' }
  }

  void syncCurrentSessionIfOnline().catch(() => undefined)

  return { kind: 'saved' }
}
