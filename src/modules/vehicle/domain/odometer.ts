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
  return timeline.length > 0
    ? timeline[timeline.length - 1].odometerKm
    : fallbackKm ?? null
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
