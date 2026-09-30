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
})
