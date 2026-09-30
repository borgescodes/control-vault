import { MAX_FUEL_INPUT_CENTS, MAX_ODOMETER_KM } from './domain/config'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function limitMoneyDigits(
  current: string,
  nextValue: string,
): string {
  const digits = digitsOnly(nextValue)
  return Number(digits || 0) <= MAX_FUEL_INPUT_CENTS ? digits : current
}

export function limitOdometerDigits(current: string, nextValue: string): string {
  const digits = digitsOnly(nextValue)
  return Number(digits || 0) <= MAX_ODOMETER_KM * 10 ? digits : current
}

export function odometerDigitsFromKm(value: number): string {
  return String(Math.round(value * 10))
}

export function formatMoneyInput(value: string): string {
  const digits = digitsOnly(value)
  return digits ? currency.format(Number(digits) / 100) : ''
}

export function parseMoneyCents(value: string): number {
  const digits = digitsOnly(value)
  return digits ? Number(digits) : 0
}

export function formatOdometerInput(value: string): string {
  const digits = digitsOnly(value)
  return digits ? (Number(digits) / 10).toFixed(1) : ''
}

export function parseOdometerKm(value: string): number {
  const digits = digitsOnly(value)
  return digits ? Number(digits) / 10 : 0
}

export function formatOdometerValue(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : 'Indisponível'
}
