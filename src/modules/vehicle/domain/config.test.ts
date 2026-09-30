import { describe, expect, it } from 'vitest'

import { getMaxFuelAmountCents } from './config'

describe('dynamic fuel amount limit', () => {
  it.each([
    [7, 2_800],
    [7.05, 2_820],
    [7.053, 2_820],
    [8.2, 3_280],
  ])('allows four liters at R$ %s/L', (pricePerLiter, expectedCents) => {
    expect(getMaxFuelAmountCents(pricePerLiter)).toBe(expectedCents)
  })

  it('rounds the reference price to the displayed cent before applying four liters', () => {
    expect(getMaxFuelAmountCents(7.001)).toBe(2_800)
    expect(getMaxFuelAmountCents(7.005)).toBe(2_804)
    expect(getMaxFuelAmountCents(8.075)).toBe(3_232)
    expect(getMaxFuelAmountCents(8.165)).toBe(3_268)
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
