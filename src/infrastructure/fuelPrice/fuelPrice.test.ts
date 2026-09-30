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

  it('refreshes after semanaFim when next check is due', async () => {
    cacheReference(currentReference)
    const fetchMock = vi.fn().mockResolvedValue(okResponse(newerReference))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFuelPriceReference(
      new Date(2026, 8, 27, 8, 0, 0),
    )

    expect(result).toEqual(newerReference)
    expect(fetchMock).toHaveBeenCalledOnce()

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    expect(cached.reference).toEqual(newerReference)
    expect(cached.nextCheckAt).toBeNull()
  })

  it('keeps stale reference when refresh fails and throttles for 12 hours', async () => {
    cacheReference(currentReference)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const now = new Date(2026, 8, 27, 8, 0, 0)
    const result = await getFuelPriceReference(now)

    expect(result).toEqual(currentReference)

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    expect(cached.reference).toEqual(currentReference)
    expect(cached.nextCheckAt).toBe(
      new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    )
  })

  it('keeps same expired week and throttles for 12 hours', async () => {
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
      new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
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

  it('returns null when no cache exists and request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(
      getFuelPriceReference(new Date(2026, 8, 27, 8, 0, 0)),
    ).resolves.toBeNull()
  })

  it('returns null when API URL is missing and no cache exists', async () => {
    vi.stubEnv('VITE_FUEL_PRICE_API_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getFuelPriceReference(new Date(2026, 8, 27, 8, 0, 0)),
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
