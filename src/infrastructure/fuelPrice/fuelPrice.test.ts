// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as prices from './fuelPrice'

const KEY = 'control-vault:fuel-price:PA:PARAGOMINAS:GASOLINA-COMUM'
const reference: prices.FuelPriceReference = {
  uf: 'PA', municipio: 'PARAGOMINAS', produto: 'GASOLINA COMUM',
  semanaInicio: '2026-10-04', semanaFim: '2026-10-10',
  precoMedio: 7.053, precoMinimo: 6.79, precoMaximo: 7.22, postosPesquisados: 7,
}
const old = { ...reference, semanaInicio: '2026-09-20', semanaFim: '2026-09-26' }
const now = new Date(2026, 9, 17, 8)
const response = (value: unknown = reference) => ({ ok: true, json: async () => value }) as Response
function cache(value = reference, fetchedAt = new Date(now.getTime() - 4 * 3_600_000).toISOString()) {
  localStorage.setItem(KEY, JSON.stringify({ reference: value, fetchedAt,
    nextCheckAt: new Date(now.getTime() + 3 * 3_600_000).toISOString() }))
}

describe('ANP reference retrieval and recovery', () => {
  const stops: (() => void)[] = []
  function watch() {
    const updates = vi.fn()
    stops.push(prices.subscribeFuelPriceReference(updates))
    return updates
  }
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.stubEnv('VITE_FUEL_PRICE_API_URL', 'https://fuel.example')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    localStorage.clear()
  })
  afterEach(() => {
    stops.splice(0).forEach((stop) => stop())
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    localStorage.clear()
  })
  it('uses a valid local reference immediately even offline', async () => {
    cache()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    expect(await prices.getFuelPriceReference(now)).toEqual(reference)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('fetches the exact location/product and caches a valid response', async () => {
    const fetcher = vi.fn().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetcher)
    expect(await prices.getFuelPriceReference(now)).toEqual(reference)
    const url = fetcher.mock.calls[0][0] as URL
    expect(url.origin + url.pathname).toBe('https://fuel.example/v1/precos')
    expect(Object.fromEntries(url.searchParams)).toEqual({ uf: 'PA', municipio: 'PARAGOMINAS', produto: 'GASOLINA COMUM' })
    expect(JSON.parse(localStorage.getItem(KEY)!).reference).toEqual(reference)
  })
  it('bounds a one-shot action lookup to two seconds without inventing a price', async () => {
    let signal: AbortSignal | null | undefined
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => {
      signal = init.signal
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('timeout'))))
    }))
    const lookup = prices.getFuelPriceReference(now)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(await lookup).toBeNull()
    expect(signal?.aborted).toBe(true)
    expect(localStorage.getItem(KEY)).toBeNull()
  })
  it.each([
    { ...reference, produto: 'GASOLINA ADITIVADA' }, { ...reference, municipio: 'BELEM' }, { ...reference, uf: 'AM' },
    { ...reference, semanaInicio: '2026-10-18', semanaFim: '2026-10-24' },
    { ...reference, semanaFim: '2026-02-30' }, { ...reference, precoMedio: 0 },
    { ...reference, precoMedio: Number.NaN }, { ...reference, precoMinimo: -1 },
    { ...reference, precoMaximo: 6 }, { ...reference, postosPesquisados: 0 }, old,
  ])('rejects unusable API references %#', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(value)))
    expect(await prices.getFuelPriceReference(now)).toBeNull()
  })
  it('does not lose a valid network response when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    expect(await prices.getFuelPriceReference(now)).toEqual(reference)
  })
  it('publishes null immediately on first install, then a response slower than two seconds', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => setTimeout(() => resolve(response()), 5_000))))
    const updates = watch()
    expect(updates).toHaveBeenLastCalledWith(null)
    await vi.advanceTimersByTimeAsync(2_001)
    expect(updates).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2_999)
    expect(updates).toHaveBeenLastCalledWith(reference)
  })
  it('recovers after a 60-second timeout without reopening the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) =>
      init.signal?.addEventListener('abort', () => reject(new Error('timeout'))))).mockResolvedValue(response()))
    const updates = watch()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(updates).toHaveBeenLastCalledWith(null)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(updates).toHaveBeenLastCalledWith(reference)
  })
  it('keeps valid cache on 503 and retries despite a legacy three-hour throttle', async () => {
    cache()
    const newer = { ...reference, semanaInicio: '2026-10-11', semanaFim: '2026-10-17' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue(response(newer)))
    const updates = watch()
    expect(updates).toHaveBeenLastCalledWith(reference)
    await vi.advanceTimersByTimeAsync(0)
    expect(JSON.parse(localStorage.getItem(KEY)!).reference).toEqual(reference)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(updates).toHaveBeenLastCalledWith(newer)
  })
  it('hides expired cache despite future nextCheckAt and refreshes immediately', async () => {
    cache(old)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    const updates = watch()
    expect(updates).toHaveBeenLastCalledWith(null)
    await vi.advanceTimersByTimeAsync(0)
    expect(updates).toHaveBeenLastCalledWith(reference)
  })
  it('recovers when connectivity returns without reopening', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetcher = vi.fn().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetcher)
    const updates = watch()
    expect(updates).toHaveBeenLastCalledWith(null)
    expect(fetcher).not.toHaveBeenCalled()
    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(updates).toHaveBeenLastCalledWith(reference)
  })
  it('does not overlap requests and aborts/removes listeners and timers on unsubscribe', async () => {
    let signal: AbortSignal | null | undefined
    const fetcher = vi.fn((_url, init: RequestInit) => {
      signal = init.signal
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))))
    })
    vi.stubGlobal('fetch', fetcher)
    watch()
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('focus'))
    expect(fetcher).toHaveBeenCalledTimes(1)
    stops.pop()!()
    expect(signal?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(180_000)
    window.dispatchEvent(new Event('online'))
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not roll back a newer cache if the server returns an older week', async () => {
    const newer = { ...reference, semanaInicio: '2026-10-11', semanaFim: '2026-10-17' }
    cache(newer)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    const updates = watch()
    await vi.advanceTimersByTimeAsync(0)
    expect(updates).toHaveBeenLastCalledWith(newer)
    expect(JSON.parse(localStorage.getItem(KEY)!).reference).toEqual(newer)
  })
  it('expires the visible reference at the local day boundary while offline', async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 59))
    cache(reference, new Date().toISOString())
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn())
    const updates = watch()
    expect(updates).toHaveBeenLastCalledWith(reference)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(updates).toHaveBeenLastCalledWith(null)
  })
  it('does not refetch a recently successful reference on focus', async () => {
    cache(reference, now.toISOString())
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const updates = watch()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(updates).toHaveBeenLastCalledWith(reference)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('refreshes immediately when a recently checked reference expires online', async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 59))
    cache(reference, new Date().toISOString())
    const newest = { ...reference, semanaInicio: '2026-10-18', semanaFim: '2026-10-24' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(newest)))
    const updates = watch()
    expect(updates).toHaveBeenLastCalledWith(reference)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(updates).toHaveBeenLastCalledWith(newest)
  })
  it('hides expired cache even while a background request is still pending', async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 59))
    cache()
    const fetcher = vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) =>
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')))))
    vi.stubGlobal('fetch', fetcher)
    const updates = watch()
    expect(updates).toHaveBeenLastCalledWith(reference)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(updates).toHaveBeenLastCalledWith(null)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each(['', '{broken'])('handles absent configuration and malformed cache: %s', async (raw) => {
    localStorage.setItem(KEY, raw)
    vi.stubEnv('VITE_FUEL_PRICE_API_URL', '')
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    expect(await prices.getFuelPriceReference(now)).toBeNull()
    const updates = watch()
    expect(updates).toHaveBeenLastCalledWith(null)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
