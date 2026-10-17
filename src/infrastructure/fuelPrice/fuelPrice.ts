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

const CACHE_KEY = 'control-vault:fuel-price:PA:PARAGOMINAS:GASOLINA-COMUM'
const RECHECK_AFTER_MS = 3 * 60 * 60 * 1000
const RETRY_AFTER_MS = 30_000
const BACKGROUND_TIMEOUT_MS = 60_000
const REQUEST_TIMEOUT_MS = 2_000

function localDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isRecentReference(reference: FuelPriceReference, now: Date): boolean {
  const oldest = new Date(now)
  oldest.setDate(oldest.getDate() - 14)
  return reference.semanaInicio <= localDate(now) && reference.semanaFim >= localDate(oldest)
}

function expiresAt(reference: FuelPriceReference): number {
  const end = new Date(`${reference.semanaFim}T00:00:00`)
  end.setDate(end.getDate() + 15)
  return end.getTime()
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function isFuelPriceReference(value: unknown): value is FuelPriceReference {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return r.uf === 'PA' && r.municipio === 'PARAGOMINAS' && r.produto === 'GASOLINA COMUM' &&
    isDateOnly(r.semanaInicio) && isDateOnly(r.semanaFim) && r.semanaInicio <= r.semanaFim &&
    typeof r.precoMedio === 'number' && Number.isFinite(r.precoMedio) && r.precoMedio > 0 &&
    typeof r.precoMinimo === 'number' && Number.isFinite(r.precoMinimo) && r.precoMinimo > 0 &&
    typeof r.precoMaximo === 'number' && Number.isFinite(r.precoMaximo) &&
    r.precoMinimo <= r.precoMedio && r.precoMedio <= r.precoMaximo &&
    typeof r.postosPesquisados === 'number' && Number.isInteger(r.postosPesquisados) && r.postosPesquisados > 0
}

function readCache(): FuelPriceCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FuelPriceCache> | null
    if (!parsed || !isFuelPriceReference(parsed.reference) ||
      typeof parsed.fetchedAt !== 'string' || !Number.isFinite(Date.parse(parsed.fetchedAt))) return null
    return { reference: parsed.reference, fetchedAt: parsed.fetchedAt, nextCheckAt: parsed.nextCheckAt ?? null }
  } catch {
    return null
  }
}

function saveReference(reference: FuelPriceReference, now: Date): FuelPriceCache {
  const cache = {
    reference,
    fetchedAt: now.toISOString(),
    nextCheckAt: new Date(now.getTime() + RECHECK_AFTER_MS).toISOString(),
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Public reference caching is optional; keep the response usable in memory.
  }
  return cache
}

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

async function fetchReference(timeoutMs: number, controller = new AbortController()): Promise<FuelPriceReference | null> {
  const baseUrl = import.meta.env.VITE_FUEL_PRICE_API_URL?.trim()
  if (!baseUrl || !online()) return null
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = new URL('/v1/precos', baseUrl)
    url.searchParams.set('uf', 'PA')
    url.searchParams.set('municipio', 'PARAGOMINAS')
    url.searchParams.set('produto', 'GASOLINA COMUM')
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    const payload: unknown = await response.json()
    return isFuelPriceReference(payload) ? payload : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// Action fallback only. Mounted views use the cancellable background subscription.
export async function getFuelPriceReference(
  now: Date,
  onRefresh?: (reference: FuelPriceReference) => void,
): Promise<FuelPriceReference | null> {
  const cached = readCache()
  if (cached && isRecentReference(cached.reference, now)) return cached.reference
  const fresh = await fetchReference(REQUEST_TIMEOUT_MS)
  if (!fresh || !isRecentReference(fresh, now)) return null
  saveReference(fresh, now)
  onRefresh?.(fresh)
  return fresh
}

export function subscribeFuelPriceReference(
  onChange: (reference: FuelPriceReference | null) => void,
): () => void {
  let active = true
  let cache = readCache()
  let request: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let expiryTimer: ReturnType<typeof setTimeout> | undefined

  function publish() {
    clearTimeout(expiryTimer)
    const reference = cache && isRecentReference(cache.reference, new Date()) ? cache.reference : null
    onChange(reference)
    if (reference) expiryTimer = setTimeout(publish, expiresAt(reference) - Date.now())
  }

  function schedule(delay: number) {
    clearTimeout(timer)
    if (active) timer = setTimeout(() => void refresh(), delay)
  }

  async function refresh() {
    if (!active || request) return
    clearTimeout(timer)
    publish()
    if (!online()) return

    // Old versions wrote nextCheckAt before a failed attempt. Only fetchedAt
    // records a successful lookup, so legacy failure throttles cannot lock us out.
    const remaining = cache && isRecentReference(cache.reference, new Date())
      ? Date.parse(cache.fetchedAt) + RECHECK_AFTER_MS - Date.now() : 0
    if (remaining > 0 && remaining <= RECHECK_AFTER_MS) {
      schedule(remaining)
      return
    }

    const controller = new AbortController()
    request = controller
    const fresh = await fetchReference(BACKGROUND_TIMEOUT_MS, controller)
    request = null
    if (!active) return
    const now = new Date()
    if (fresh && isRecentReference(fresh, now)) {
      const saved = readCache()
      const candidates = [cache?.reference, saved?.reference, fresh].filter(
        (value): value is FuelPriceReference => !!value && isRecentReference(value, now),
      )
      const newest = candidates.sort((a, b) => b.semanaFim.localeCompare(a.semanaFim))[0]
      cache = saveReference(newest, now)
      publish()
      schedule(RECHECK_AFTER_MS)
    } else {
      publish()
      schedule(RETRY_AFTER_MS)
    }
  }

  function wake() { void refresh() }
  function visible() { if (document.visibilityState === 'visible') wake() }
  window.addEventListener('online', wake)
  window.addEventListener('focus', wake)
  document.addEventListener('visibilitychange', visible)
  void refresh()

  return () => {
    active = false
    clearTimeout(timer)
    clearTimeout(expiryTimer)
    request?.abort()
    window.removeEventListener('online', wake)
    window.removeEventListener('focus', wake)
    document.removeEventListener('visibilitychange', visible)
  }
}
