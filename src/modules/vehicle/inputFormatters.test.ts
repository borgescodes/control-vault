import { describe, expect, it } from 'vitest'

import {
  digitsOnly,
  formatMoneyInput,
  formatOdometerInput,
  formatDistanceInput,
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
  it('formats distance with shifted tenths and a pt-BR comma', () => {
    expect(['1', '14', '140', '145'].map(formatDistanceInput)).toEqual(['0,1', '1,4', '14,0', '14,5'])
    expect(formatDistanceInput('')).toBe('')
    expect(parseOdometerKm('145')).toBe(14.5)
  })

  it('bounds digit length even for leading zeros and strips arbitrary characters', () => {
    expect(limitOdometerDigits('145', '0'.repeat(100))).toBe('145')
    expect(limitOdometerDigits('145', '999999999999999999')).toBe('145')
    expect(limitOdometerDigits('', 'abc14,5 km')).toBe('145')
    expect(limitOdometerDigits('145', '')).toBe('')
  })
  it('limits the money mask to R$ 99,99 independently of the business cap', () => {
    expect(limitMoneyDigits('2820', '2821')).toBe('2821')
    expect(limitMoneyDigits('9998', '9999')).toBe('9999')
    expect(limitMoneyDigits('9999', '99990')).toBe('9999')
    expect(limitMoneyDigits('9999', '10000')).toBe('9999')
  })

  it('keeps odometer input at 999999.0 km or below', () => {
    expect(limitOdometerDigits('9999990', '9999999')).toBe('9999990')
    expect(limitOdometerDigits('124830', '9999990')).toBe('9999990')
  })

  it('converts the current odometer back to editable implicit-decimal digits', () => {
    expect(odometerDigitsFromKm(12483.6)).toBe('124836')
  })
})
