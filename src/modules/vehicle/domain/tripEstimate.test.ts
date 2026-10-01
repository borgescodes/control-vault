import { describe, expect, it } from 'vitest'

import { estimateTrip } from './tripEstimate'

describe('estimateTrip', () => {
  it('calculates an outbound-only trip from current consumption and fuel price', () => {
    expect(
      estimateTrip({
        outboundDistanceKm: 14,
        returnDistanceKm: null,
        consumptionKmPerLiter: 40,
        fuelPricePerLiter: 7,
      }),
    ).toEqual({
      outbound: { distanceKm: 14, liters: 0.35, costCents: 245 },
      returnTrip: null,
      total: { distanceKm: 14, liters: 0.35, costCents: 245 },
    })
  })

  it('keeps distinct outbound and return distances and sums their totals', () => {
    const result = estimateTrip({
      outboundDistanceKm: 14,
      returnDistanceKm: 16,
      consumptionKmPerLiter: 40,
      fuelPricePerLiter: 7,
    })

    expect(result.outbound).toEqual({
      distanceKm: 14,
      liters: 0.35,
      costCents: 245,
    })
    expect(result.returnTrip).toEqual({
      distanceKm: 16,
      liters: 0.4,
      costCents: 280,
    })
    expect(result.total).toEqual({
      distanceKm: 30,
      liters: 0.75,
      costCents: 525,
    })
  })

  it('keeps distance visible while consumption is still unavailable', () => {
    expect(
      estimateTrip({
        outboundDistanceKm: 14,
        returnDistanceKm: 16,
        consumptionKmPerLiter: null,
        fuelPricePerLiter: 7,
      }),
    ).toEqual({
      outbound: { distanceKm: 14, liters: null, costCents: null },
      returnTrip: { distanceKm: 16, liters: null, costCents: null },
      total: { distanceKm: 30, liters: null, costCents: null },
    })
  })

  it('still estimates liters when fuel price is unavailable', () => {
    const result = estimateTrip({
      outboundDistanceKm: 14,
      returnDistanceKm: null,
      consumptionKmPerLiter: 40,
      fuelPricePerLiter: null,
    })

    expect(result.outbound.liters).toBeCloseTo(0.35)
    expect(result.outbound.costCents).toBeNull()
  })

  it.each([0, -1, Number.NaN])('rejects invalid outbound distance %s', (distance) => {
    expect(() =>
      estimateTrip({
        outboundDistanceKm: distance,
        returnDistanceKm: null,
        consumptionKmPerLiter: 40,
        fuelPricePerLiter: 7,
      }),
    ).toThrow(RangeError)
  })

  it('rejects an invalid configured return distance', () => {
    expect(() =>
      estimateTrip({
        outboundDistanceKm: 14,
        returnDistanceKm: 0,
        consumptionKmPerLiter: 40,
        fuelPricePerLiter: 7,
      }),
    ).toThrow(RangeError)
  })
})
