import { describe, expect, it } from 'vitest'

import {
  digitsOnly,
  formatMoneyInput,
  formatOdometerInput,
  parseMoneyCents,
  parseOdometerKm,
} from './inputFormatters'

describe('vehicle input formatters', () => {
  it('treats typed money digits as cents with shifting decimal', () => {
    expect(formatMoneyInput('2')).toBe('R$ 0,02')
    expect(formatMoneyInput('25')).toBe('R$ 0,25')
    expect(formatMoneyInput('257')).toBe('R$ 2,57')
    expect(formatMoneyInput('2570')).toBe('R$ 25,70')
    expect(formatMoneyInput('2572')).toBe('R$ 25,72')
  })

  it('naturally reverses one money digit on backspace', () => {
    expect(formatMoneyInput('2570')).toBe('R$ 25,70')
    expect(formatMoneyInput('257')).toBe('R$ 2,57')
    expect(formatMoneyInput('2572')).toBe('R$ 25,72')
  })

  it('keeps money storage in integer cents', () => {
    expect(parseMoneyCents('1000')).toBe(1000)
    expect(parseMoneyCents('1500')).toBe(1500)
    expect(parseMoneyCents('2572')).toBe(2572)
  })

  it('treats odometer digits as one implicit decimal place', () => {
    expect(formatOdometerInput('1')).toBe('0.1')
    expect(formatOdometerInput('12')).toBe('1.2')
    expect(formatOdometerInput('124830')).toBe('12483.0')
    expect(parseOdometerKm('124830')).toBe(12483)
  })

  it('strips punctuation and labels before reformatting controlled inputs', () => {
    expect(digitsOnly('R$ 25,70')).toBe('2570')
    expect(digitsOnly('12483.0 km')).toBe('124830')
  })
})
