export type FuelPriceReference = {
  uf: string
  municipio: string
  produto: string
  semanaInicio: string
  semanaFim: string
  precoMedio: number
  precoMinimo: number
  precoMaximo: number
  postosPesquisados: number
}

type FuelPriceCache = {
  reference: FuelPriceReference
  fetchedAt: string
  nextCheckAt: string | null
}

const CACHE_KEY =
  'control-vault:fuel-price:PA:PARAGOMINAS:GASOLINA-COMUM'
const RECHECK_AFTER_MS = 12 * 60 * 60 * 1000

function localDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function isFuelPriceReference(value: unknown): value is FuelPriceReference {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.uf === 'string' &&
    typeof candidate.municipio === 'string' &&
    typeof candidate.produto === 'string' &&
    isDateOnly(candidate.semanaInicio) &&
    isDateOnly(candidate.semanaFim) &&
    candidate.semanaInicio <= candidate.semanaFim &&
    typeof candidate.precoMedio === 'number' &&
    Number.isFinite(candidate.precoMedio) &&
    candidate.precoMedio > 0 &&
    typeof candidate.precoMinimo === 'number' &&
    Number.isFinite(candidate.precoMinimo) &&
    typeof candidate.precoMaximo === 'number' &&
    Number.isFinite(candidate.precoMaximo) &&
    typeof candidate.postosPesquisados === 'number' &&
    Number.isFinite(candidate.postosPesquisados)
  )
}

function readCache(): FuelPriceCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<FuelPriceCache>
    if (
      !isFuelPriceReference(parsed.reference) ||
      typeof parsed.fetchedAt !== 'string' ||
      (parsed.nextCheckAt !== null && typeof parsed.nextCheckAt !== 'string')
    ) {
      return null
    }

    return parsed as FuelPriceCache
  } catch {
    return null
  }
}

function writeCache(cache: FuelPriceCache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

function nextCheckAt(now: Date): string {
  return new Date(now.getTime() + RECHECK_AFTER_MS).toISOString()
}

async function fetchReference(): Promise<FuelPriceReference | null> {
  const baseUrl = import.meta.env.VITE_FUEL_PRICE_API_URL?.trim()
  if (!baseUrl) return null

  try {
    const url = new URL('/v1/precos', baseUrl)
    url.searchParams.set('uf', 'PA')
    url.searchParams.set('municipio', 'PARAGOMINAS')
    url.searchParams.set('produto', 'GASOLINA COMUM')

    const response = await fetch(url)
    if (!response.ok) return null

    const payload: unknown = await response.json()
    return isFuelPriceReference(payload) ? payload : null
  } catch {
    return null
  }
}

export async function getFuelPriceReference(
  now: Date,
): Promise<FuelPriceReference | null> {
  const today = localDate(now)
  const cached = readCache()

  if (
    cached &&
    cached.reference.semanaInicio <= today &&
    today <= cached.reference.semanaFim
  ) {
    return cached.reference
  }

  if (
    cached?.nextCheckAt &&
    Date.parse(cached.nextCheckAt) > now.getTime()
  ) {
    return cached.reference
  }

  const fresh = await fetchReference()

  if (!fresh) {
    if (!cached) return null

    writeCache({
      ...cached,
      nextCheckAt: nextCheckAt(now),
    })
    return cached.reference
  }

  if (
    cached &&
    fresh.semanaFim <= cached.reference.semanaFim &&
    today > fresh.semanaFim
  ) {
    writeCache({
      ...cached,
      nextCheckAt: nextCheckAt(now),
    })
    return cached.reference
  }

  writeCache({
    reference: fresh,
    fetchedAt: now.toISOString(),
    nextCheckAt: today > fresh.semanaFim ? nextCheckAt(now) : null,
  })
  return fresh
}
