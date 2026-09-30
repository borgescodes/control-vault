import { describe, expect, it } from 'vitest'

import { getMaxFuelAmountCents } from './config'

describe('dynamic fuel amount limit', () => {
  it.each([
    [7, 2_800],
    [7.05, 2_820],
    [8.2, 3_280],
  ])('allows four liters at R$ %s/L', (pricePerLiter, expectedCents) => {
    expect(getMaxFuelAmountCents(pricePerLiter)).toBe(expectedCents)
  })

  it('rounds the monetary limit upward to the next cent', () => {
    expect(getMaxFuelAmountCents(7.001)).toBe(2_801)
  })

  it.each([
    [8.05, 3_220],
    [8.13, 3_252],
  ])('does not turn floating-point noise at R$ %s/L into another cent', (
    pricePerLiter,
    expectedCents,
  ) => {
    expect(getMaxFuelAmountCents(pricePerLiter)).toBe(expectedCents)
  })
})
