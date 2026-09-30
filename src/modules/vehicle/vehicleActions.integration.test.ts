// @vitest-environment jsdom

import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const syncStub = vi.hoisted(() => ({
  syncCurrentSessionIfOnline: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../infrastructure/sync/sync', () => syncStub)

import { resetLocalDatabase } from '../../infrastructure/local/db'
import { listFuelEntries } from '../../infrastructure/local/store'
import { initializeVehicle, recordFuel } from './vehicleActions'

describe('fuel action with the real price lookup', () => {
  beforeEach(async () => {
    localStorage.clear()
    vi.stubEnv('VITE_FUEL_PRICE_API_URL', 'https://fuel.example')
    await resetLocalDatabase()
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
    await resetLocalDatabase()
  })

  it('aborts a hanging first lookup and still persists locally', async () => {
    await initializeVehicle(1_000, true, '2026-09-29T10:00:00.000Z')
    let requestSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal ?? undefined
          requestSignal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
      ),
    )

    const startedAt = Date.now()
    const result = await recordFuel({
      odometerKm: 1_100,
      amountCents: 9_999,
      fullTank: false,
      fueledAt: '2026-09-30T10:00:00.000Z',
    })

    expect(result).toEqual({ kind: 'saved' })
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_900)
    expect(Date.now() - startedAt).toBeLessThan(3_500)
    expect(requestSignal?.aborted).toBe(true)
    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({
        amountCents: 9_999,
        estimatedLiters: null,
        referencePricePerLiter: null,
      }),
    ])
  }, 10_000)
})
