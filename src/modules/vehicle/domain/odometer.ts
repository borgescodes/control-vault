import { SUSPICIOUS_ODOMETER_DELTA_KM } from './config'
import type { FuelEntry, OdometerReading } from './types'

export type OdometerValidation =
  | { kind: 'valid'; deltaKm: number }
  | { kind: 'suspicious'; deltaKm: number }
  | { kind: 'invalid'; deltaKm: number }

export type OdometerTimelineEntry = {
  id: string
  at: string
  odometerKm: number
  source: 'manual' | 'fuel'
}

export function getOdometerTimeline(
  readings: OdometerReading[],
  fuelEntries: FuelEntry[],
): OdometerTimelineEntry[] {
  return [
    ...readings
      .filter((reading) => reading.source === 'manual')
      .map((reading) => ({
        id: reading.id,
        at: reading.recordedAt,
        odometerKm: reading.readingKm,
        source: 'manual' as const,
      })),
    ...fuelEntries
      .filter((entry) => entry.deletedAt === null)
      .map((entry) => ({
        id: entry.id,
        at: entry.fueledAt,
        odometerKm: entry.odometerKm,
        source: 'fuel' as const,
      })),
  ].sort(
    (left, right) =>
      left.at.localeCompare(right.at) ||
      left.odometerKm - right.odometerKm ||
      left.source.localeCompare(right.source) ||
      left.id.localeCompare(right.id),
  )
}

export function getLatestOdometerKm(
  readings: OdometerReading[],
  fuelEntries: FuelEntry[],
  fallbackKm?: number,
): number | null {
  const timeline = getOdometerTimeline(readings, fuelEntries)
  const latestManual = timeline
    .filter((event) => event.source === 'manual')
    .at(-1)?.odometerKm
  const highestFuel = timeline
    .filter((event) => event.source === 'fuel')
    .reduce<number | null>(
      (highest, event) =>
        highest === null ? event.odometerKm : Math.max(highest, event.odometerKm),
      null,
    )

  const candidates = [latestManual, highestFuel, fallbackKm].filter(
    (value): value is number => value !== undefined && value !== null,
  )
  return candidates.length > 0 ? Math.max(...candidates) : null
}

export function validateOdometer(
  latestKm: number | null,
  nextKm: number,
): OdometerValidation {
  const deltaKm = latestKm === null ? 0 : nextKm - latestKm

  if (deltaKm < 0) {
    return { kind: 'invalid', deltaKm }
  }

  if (deltaKm > SUSPICIOUS_ODOMETER_DELTA_KM) {
    return { kind: 'suspicious', deltaKm }
  }

  return { kind: 'valid', deltaKm }
}


export function validateFuelEntryPosition(
  readings: OdometerReading[],
  fuelEntries: FuelEntry[],
  entryId: string,
  nextOdometerKm: number,
  nextFueledAt: string,
): OdometerValidation {
  const timeline = getOdometerTimeline(
    readings,
    fuelEntries.filter((entry) => entry.id !== entryId),
  )
  const previous = timeline
    .filter((event) => event.at <= nextFueledAt)
    .at(-1)
  const next = timeline.find((event) => event.at > nextFueledAt)
  const deltaKm = previous ? nextOdometerKm - previous.odometerKm : 0

  if (
    (previous && nextOdometerKm < previous.odometerKm) ||
    (next && nextOdometerKm > next.odometerKm)
  ) {
    return { kind: 'invalid', deltaKm }
  }

  if (deltaKm > SUSPICIOUS_ODOMETER_DELTA_KM) {
    return { kind: 'suspicious', deltaKm }
  }

  return { kind: 'valid', deltaKm }
}
