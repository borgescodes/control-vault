import {
  getFuelPriceReference,
  type FuelPriceReference,
} from '../../infrastructure/fuelPrice/fuelPrice'
import {
  getVehicleState,
  initializeLocalVehicle,
  saveFuelAndReadingIfCurrent,
  saveOdometerReadingIfCurrent,
  saveVehicleState,
} from '../../infrastructure/local/store'
import { syncCurrentSessionIfOnline } from '../../infrastructure/sync/sync'
import { createUuid } from '../../shared/uuid'
import {
  DEFAULT_TANK_CAPACITY_LITERS,
  getMaxFuelAmountCents,
  MAX_FUEL_INPUT_CENTS,
  MAX_ODOMETER_KM,
} from './domain/config'
import { validateOdometer } from './domain/odometer'
import type { FuelEntry, OdometerReading, VehicleState } from './domain/types'
import { fullTankFingerprint } from './fuelEntries'

export type RecordResult =
  | { kind: 'saved' }
  | { kind: 'requires_confirmation'; deltaKm: number }
  | { kind: 'invalid'; reason: string }

export type FuelInput = {
  odometerKm: number
  amountCents: number
  fullTank: boolean
  fueledAt: string
  priceReference?: FuelPriceReference | null
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
  if (
    !Number.isFinite(initialOdometerKm) ||
    initialOdometerKm < 0 ||
    initialOdometerKm > MAX_ODOMETER_KM
  ) {
    throw new RangeError('Hodômetro inválido')
  }

  if (!hasValidTimestamp(now)) {
    throw new RangeError('Data inválida')
  }

  const state: VehicleState = {
    nominalTankCapacityLiters: DEFAULT_TANK_CAPACITY_LITERS,
    initialOdometerKm,
    initialFullTankAt: initialFullTank ? now : null,
    createdAt: now,
    updatedAt: now,
  }
  const reading: OdometerReading = {
    id: createUuid(),
    readingKm: initialOdometerKm,
    recordedAt: now,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }

  await initializeLocalVehicle(state, reading)
  void syncCurrentSessionIfOnline().catch(() => undefined)
}

export async function updateTankCapacity(
  nominalTankCapacityLiters: number,
  now: string,
): Promise<RecordResult> {
  if (
    !Number.isFinite(nominalTankCapacityLiters) ||
    nominalTankCapacityLiters <= 0
  ) {
    return { kind: 'invalid', reason: 'Capacidade inválida' }
  }

  if (!hasValidTimestamp(now)) {
    return { kind: 'invalid', reason: 'Data inválida' }
  }

  const state = await getVehicleState()
  if (!state) {
    return { kind: 'invalid', reason: 'Veículo não configurado' }
  }

  await saveVehicleState({
    ...state,
    nominalTankCapacityLiters,
    updatedAt: now,
  })
  void syncCurrentSessionIfOnline().catch(() => undefined)

  return { kind: 'saved' }
}

export async function recordOdometer(
  readingKm: number,
  recordedAt: string,
  confirmSuspicious = false,
): Promise<RecordResult> {
  if (
    !Number.isFinite(readingKm) ||
    readingKm < 0 ||
    readingKm > MAX_ODOMETER_KM
  ) {
    return { kind: 'invalid', reason: 'Hodômetro inválido' }
  }

  if (!hasValidTimestamp(recordedAt)) {
    return { kind: 'invalid', reason: 'Data inválida' }
  }

  const reading: OdometerReading = {
    id: createUuid(),
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
  if (
    !Number.isFinite(input.odometerKm) ||
    input.odometerKm < 0 ||
    input.odometerKm > MAX_ODOMETER_KM
  ) {
    return { kind: 'invalid', reason: 'Hodômetro inválido' }
  }

  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents > MAX_FUEL_INPUT_CENTS
  ) {
    return { kind: 'invalid', reason: 'Valor inválido' }
  }

  if (!hasValidTimestamp(input.fueledAt)) {
    return { kind: 'invalid', reason: 'Data inválida' }
  }

  let reference: FuelPriceReference | null = null
  if (Object.hasOwn(input, 'priceReference')) {
    reference = input.priceReference ?? null
  } else {
    try {
      reference = await getFuelPriceReference(new Date(input.fueledAt))
    } catch {
      reference = null
    }
  }

  if (reference) {
    const state = await getVehicleState()
    if (
      !state ||
      input.amountCents >
        getMaxFuelAmountCents(
          reference.precoMaximo,
          state.nominalTankCapacityLiters,
        )
    ) {
      return { kind: 'invalid', reason: 'Valor inválido' }
    }
  }

  const estimatedLiters = reference
    ? roundLiters((input.amountCents / 100) / reference.precoMedio)
    : null

  const entry: FuelEntry = {
    id: createUuid(),
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
    id: createUuid(),
    readingKm: input.odometerKm,
    recordedAt: input.fueledAt,
    source: 'fuel_entry',
    createdAt: input.fueledAt,
    updatedAt: input.fueledAt,
  }

  let validation: ReturnType<typeof validateOdometer> | undefined
  let duplicate = false
  const saved = await saveFuelAndReadingIfCurrent(
    entry,
    reading,
    (latest, existingEntries) => {
      const fingerprint = fullTankFingerprint(entry)
      if (fingerprint !== null && existingEntries.some((existing) => fullTankFingerprint(existing) === fingerprint)) {
        duplicate = true
        return false
      }
      validation = validateOdometer(latest, input.odometerKm)
      return (
        validation.kind === 'valid' ||
        (validation.kind === 'suspicious' && confirmSuspicious)
      )
    },
  )

  if (!saved) {
    if (duplicate) return { kind: 'invalid', reason: 'Abastecimento já registrado' }
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
