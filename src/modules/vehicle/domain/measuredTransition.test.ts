import { describe, expect, it } from 'vitest'
import {
  buildMeasuredConsumptionCycles,
  latestMeasuredPricePerLiter,
  learnConsumption,
} from './consumption'
import { estimateFuelRemaining } from './fuelEstimate'
import type { FuelEntry, OdometerReading } from './types'

function fuel(
  id: string, km: number, liters: number | null, fullTank: boolean, at: string,
  estimatedLiters: number | null = null,
): FuelEntry {
  return {
    id, odometerKm: km, amountCents: 700, liters, estimatedLiters,
    referencePricePerLiter: null, referenceWeekStart: null,
    referenceWeekEnd: null, fullTank, fueledAt: at, deletedAt: null,
    createdAt: at, updatedAt: at,
  }
}
const t = (day: number) => `2026-10-${String(day).padStart(2, '0')}T12:00:00Z`

describe('measured pump transition without data loss', () => {
  it('derives the pump price from exact value and volume, not an ANP quote', () => {
    const entries = [
      fuel('old', 1_000, null, false, t(10), 1.2),
      fuel('pump', 1_050, 0.91, false, t(11), 0.99),
    ]
    expect(latestMeasuredPricePerLiter(entries)).toBeCloseTo(700 / 100 / 0.91)
    expect(latestMeasuredPricePerLiter([entries[0]])).toBeNull()
    expect(buildMeasuredConsumptionCycles(entries)).toEqual([])
  })

  it('restarts calibration with measured full tanks and only measured fills', () => {
    const entries = [
      fuel('legacy', 1_000, null, true, t(10), 3),
      fuel('initial', 1_040, 1.1, true, t(11)),
      fuel('partial', 1_070, 0.5, false, t(12)),
      fuel('closing', 1_100, 1, true, t(13)),
    ]
    const cycles = buildMeasuredConsumptionCycles(entries)
    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toMatchObject({
      startKm: 1_040, endKm: 1_100, distanceKm: 60, fuelUsedLiters: 1.5,
      kmPerLiter: 40,
    })
    expect(learnConsumption(cycles)?.calibrationState).toBe('estimated')
  })

  it('rejects a new cycle contaminated by ANP estimates', () => {
    const entries = [
      fuel('start', 1_000, 1.5, true, t(10)),
      fuel('legacy', 1_030, null, false, t(11), 0.75),
      fuel('end', 1_060, 1, true, t(12)),
      fuel('end2', 1_120, 1.5, true, t(13)),
    ]
    const cycles = buildMeasuredConsumptionCycles(entries)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].startKm).toBe(1_060)
    expect(cycles[0].kmPerLiter).toBe(40)
  })

  it('retains a 3.11 L pump measurement while limiting estimated tank balance to 3 L', () => {
    const observedEmpty: OdometerReading = {
      id: 'empty-at-pump', readingKm: 1_050, recordedAt: '2026-10-23T12:00:00Z',
      source: 'manual', tankEmpty: true,
      createdAt: '2026-10-23T12:00:00Z', updatedAt: '2026-10-23T12:00:00Z',
    }
    const measured = fuel('pump-3-11', 1_050, 3.11, false, '2026-10-23T12:01:00Z')
    const estimate = estimateFuelRemaining({
      nominalTankCapacityLiters: 3, consumptionKmPerLiter: 40,
      initialAnchor: null, fuelEntries: [measured],
      odometerReadings: [observedEmpty], currentOdometerKm: 1_050,
    })
    expect(measured.liters).toBe(3.11)
    expect(estimate?.remainingLiters).toBe(3)
    expect(estimate?.fuelPercent).toBe(100)
  })

  it('anchors zero before refueling at identical mileage, then adds the measured liters', () => {
    const empty: OdometerReading = {
      id: 'empty', readingKm: 13_590.5, recordedAt: '2026-10-23T21:45:54Z',
      source: 'manual', tankEmpty: true, createdAt: t(23), updatedAt: t(23),
    }
    const pump = fuel('pump', 13_590.5, 0.91, false, '2026-10-23T21:45:57Z')
    const before = estimateFuelRemaining({
      nominalTankCapacityLiters: 3, consumptionKmPerLiter: 40,
      initialAnchor: { odometerKm: 13_350, at: t(10) },
      fuelEntries: [], odometerReadings: [empty], currentOdometerKm: 13_590.5,
    })
    const after = estimateFuelRemaining({
      nominalTankCapacityLiters: 3, consumptionKmPerLiter: 40,
      initialAnchor: { odometerKm: 13_350, at: t(10) },
      fuelEntries: [pump], odometerReadings: [empty],
      currentOdometerKm: 13_590.5,
    })
    expect(before?.remainingLiters).toBe(0)
    expect(after?.remainingLiters).toBeCloseTo(0.91)
    expect(after?.fuelPercent).toBeCloseTo(0.91 / 3 * 100)
  })
})
