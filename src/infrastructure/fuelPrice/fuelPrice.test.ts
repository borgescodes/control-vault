// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getFuelPriceReference,
  type FuelPriceReference,
} from './fuelPrice'

const CACHE_KEY =
  'control-vault:fuel-price:PA:PARAGOMINAS:GASOLINA-COMUM'

const currentReference: FuelPriceReference = {
  uf: 'PA',
  municipio: 'PARAGOMINAS',
  produto: 'GASOLINA COMUM',
  semanaInicio: '2026-09-20',
  semanaFim: '2026-09-26',
  precoMedio: 7.05,
  precoMinimo: 6.79,
  precoMaximo: 7.22,
  postosPesquisados: 37,
}

const newerReference: FuelPriceReference = {
  ...currentReference,
  semanaInicio: '2026-09-27',
  semanaFim: '2026-10-03',
  precoMedio: 7.08,
}

function cacheReference(
  reference: FuelPriceReference,
  {
    fetchedAt = '2026-09-25T12:00:00.000Z',
    nextCheckAt = null,
  }: { fetchedAt?: string; nextCheckAt?: string | null } = {},
) {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ reference, fetchedAt, nextCheckAt }),
  )
}

function okResponse(value: unknown): Response {
  return {
    ok: true,
    json: async () => value,
  } as Response
}

describe('weekly fuel price reference', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('VITE_FUEL_PRICE_API_URL', 'https://fuel.example')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('uses cached reference without fetch inside week inclusive', async () => {
    cacheReference(currentReference)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFuelPriceReference(
      new Date(2026, 8, 26, 23, 59, 0),
    )

    expect(result).toEqual(currentReference)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns stale immediately and refreshes it in the background', async () => {
    cacheReference(currentReference)
    const fetchMock = vi.fn().mockResolvedValue(okResponse(newerReference))
    const onRefresh = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFuelPriceReference(
      new Date(2026, 8, 27, 8, 0, 0),
      onRefresh,
    )

    expect(result).toEqual(currentReference)
    expect(fetchMock).toHaveBeenCalledOnce()

    await vi.waitFor(() => {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
      expect(cached.reference).toEqual(newerReference)
      expect(cached.nextCheckAt).toBeNull()
    })
    expect(onRefresh).toHaveBeenCalledWith(newerReference)
  })

  it('does not wait for a hanging refresh when stale cache exists', async () => {
    cacheReference(currentReference)
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => undefined))
    vi.stubGlobal('fetch', fetchMock)

    const lookup = getFuelPriceReference(new Date(2026, 8, 27, 8, 0, 0))
    const result = await Promise.race([
      lookup,
      new Promise<'network-blocked'>((resolve) =>
        setTimeout(() => resolve('network-blocked'), 10),
      ),
    ])

    expect(result).toEqual(currentReference)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('keeps stale reference when refresh fails and throttles for 3 hours', async () => {
    cacheReference(currentReference)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const now = new Date(2026, 8, 27, 8, 0, 0)
    const result = await getFuelPriceReference(now)

    expect(result).toEqual(currentReference)

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    expect(cached.reference).toEqual(currentReference)
    expect(cached.nextCheckAt).toBe(
      new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    )
  })

  it('keeps same expired week and throttles for 3 hours', async () => {
    cacheReference(currentReference)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse(currentReference)),
    )

    const now = new Date(2026, 8, 27, 8, 0, 0)
    const result = await getFuelPriceReference(now)

    expect(result).toEqual(currentReference)

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    expect(cached.reference).toEqual(currentReference)
    expect(cached.nextCheckAt).toBe(
      new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    )
  })

  it('does not refetch an expired reference while the throttle is active', async () => {
    const now = new Date(2026, 8, 27, 8, 0, 0)
    cacheReference(currentReference, {
      nextCheckAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFuelPriceReference(now)

    expect(result).toEqual(currentReference)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not fabricate an old ANP reference when no cache exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(
      getFuelPriceReference(new Date(2026, 9, 14, 8, 0, 0)),
    ).resolves.toBeNull()
  })

  it('aborts a hanging first request after two seconds', async () => {
    vi.useFakeTimers()
    let firstRequestSignal: AbortSignal | undefined
    const fetchMock = vi.fn(
      (_url: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal ?? undefined
          firstRequestSignal ??= signal
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    let settled = false
    const lookup = getFuelPriceReference(
      new Date(2026, 8, 27, 8, 0, 0),
    ).finally(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(1_999)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(lookup).resolves.toBeNull()
    expect(firstRequestSignal?.aborted).toBe(true)
    vi.useRealTimers()
  })

  it('returns no reference when API URL and cache are missing', async () => {
    vi.stubEnv('VITE_FUEL_PRICE_API_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getFuelPriceReference(new Date(2026, 9, 14, 8, 0, 0)),
    ).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    { ...currentReference, precoMedio: 0 },
    { ...currentReference, precoMedio: Number.NaN },
    { ...currentReference, semanaInicio: 'invalid-date' },
    { ...currentReference, semanaFim: 'invalid-date' },
  ])('rejects invalid API payload %#', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(payload)))

    await expect(
      getFuelPriceReference(new Date(2026, 8, 27, 8, 0, 0)),
    ).resolves.toBeNull()
  })

  it('does not surface a three-week-old cached reference while refreshing', async () => {
    const publishedReference: FuelPriceReference = {
      ...currentReference,
      semanaInicio: '2026-10-04',
      semanaFim: '2026-10-10',
    }
    cacheReference(currentReference)
    const onRefresh = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(publishedReference)))

    await expect(
      getFuelPriceReference(new Date(2026, 9, 14, 8, 0, 0), onRefresh),
    ).resolves.toBeNull()

    await vi.waitFor(() => {
      expect(onRefresh).toHaveBeenCalledWith(publishedReference)
    })
  })

  it('rejects an expired API response on a fresh install', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(currentReference)))
    await expect(
      getFuelPriceReference(new Date(2026, 9, 14, 8, 0, 0)),
    ).resolves.toBeNull()
  })

  it('opens offline without waiting for a fuel-price network request', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      getFuelPriceReference(new Date(2026, 9, 14, 8, 0, 0)),
    ).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores malformed cache JSON', async () => {
    localStorage.setItem(CACHE_KEY, '{broken')
    const fetchMock = vi.fn().mockResolvedValue(okResponse(newerReference))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFuelPriceReference(
      new Date(2026, 8, 27, 8, 0, 0),
    )

    expect(result).toEqual(newerReference)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('compares week boundaries using local calendar date', async () => {
    cacheReference(currentReference)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getFuelPriceReference(new Date(2026, 8, 20, 0, 1, 0)),
    ).resolves.toEqual(currentReference)
    await expect(
      getFuelPriceReference(new Date(2026, 8, 26, 23, 59, 0)),
    ).resolves.toEqual(currentReference)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
