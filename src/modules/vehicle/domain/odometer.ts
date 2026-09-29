import { SUSPICIOUS_ODOMETER_DELTA_KM } from './config'

export type OdometerValidation =
  | { kind: 'valid'; deltaKm: number }
  | { kind: 'suspicious'; deltaKm: number }
  | { kind: 'invalid'; deltaKm: number }

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
