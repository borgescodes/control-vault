import type { FuelEntry } from './domain/types'

export function fullTankFingerprint(entry: FuelEntry): string | null {
  if (!entry.fullTank) return null
  return JSON.stringify([
    entry.odometerKm, entry.amountCents, entry.estimatedLiters,
    entry.referencePricePerLiter, entry.referenceWeekStart, entry.referenceWeekEnd,
  ])
}

export function uniqueFuelEntries(entries: FuelEntry[]): FuelEntry[] {
  const seen = new Set<string>()
  return entries
    .filter((entry) => entry.deletedAt === null)
    .sort((left, right) => Date.parse(left.fueledAt) - Date.parse(right.fueledAt) || left.id.localeCompare(right.id))
    .filter((entry) => {
      const fingerprint = fullTankFingerprint(entry)
      if (fingerprint === null) return true
      if (seen.has(fingerprint)) return false
      seen.add(fingerprint)
      return true
    })
}
