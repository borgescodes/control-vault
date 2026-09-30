const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
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
  return Number.isFinite(value) ? value.toFixed(1) : '—'
}
