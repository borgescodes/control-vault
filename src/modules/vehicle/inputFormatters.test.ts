import { describe, expect, it } from 'vitest'

import {
  digitsOnly,
  formatMoneyInput,
  formatOdometerInput,
  limitMoneyDigits,
  limitOdometerDigits,
  odometerDigitsFromKm,
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


describe('vehicle input limits', () => {
  it('keeps fuel input at R$ 30,00 when another digit would exceed the bike limit', () => {
    expect(limitMoneyDigits('3000', '30001')).toBe('3000')
    expect(limitMoneyDigits('2572', '3000')).toBe('3000')
  })

  it('keeps odometer input at 999999.0 km or below', () => {
    expect(limitOdometerDigits('9999990', '9999999')).toBe('9999990')
    expect(limitOdometerDigits('124830', '9999990')).toBe('9999990')
  })

  it('converts the current odometer back to editable implicit-decimal digits', () => {
    expect(odometerDigitsFromKm(12483.6)).toBe('124836')
  })
})
