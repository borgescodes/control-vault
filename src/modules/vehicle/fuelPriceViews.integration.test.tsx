// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../infrastructure/sync/sync', () => ({ syncCurrentSessionIfOnline: async () => undefined }))

import { resetLocalDatabase } from '../../infrastructure/local/db'
import { listFuelEntries } from '../../infrastructure/local/store'
import FuelView from './FuelView'
import { initializeVehicle } from './vehicleActions'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const KEY = 'control-vault:fuel-price:PA:PARAGOMINAS:GASOLINA-COMUM'
const reference = {
  uf: 'PA', municipio: 'PARAGOMINAS', produto: 'GASOLINA COMUM',
  semanaInicio: '2026-10-04', semanaFim: '2026-10-10',
  precoMedio: 7.053, precoMinimo: 6.79, precoMaximo: 7.22, postosPesquisados: 7,
}
const response = () => ({ ok: true, json: async () => reference }) as Response
function enterAmount(container: HTMLElement) {
  const input = container.querySelector('input[name="amount"]')!
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2000')
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
function expandReference(container: HTMLElement) {
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Referência')?.click()
}

describe('FuelView with real ANP lookup and IndexedDB', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 9, 17, 8))
    vi.stubEnv('VITE_FUEL_PRICE_API_URL', 'https://fuel.example')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    localStorage.clear()
    await resetLocalDatabase()
    await initializeVehicle(1_000, true, new Date().toISOString())
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    localStorage.clear()
    await resetLocalDatabase()
  })
  async function open() {
    await act(async () => root.render(<FuelView currentOdometerKm={1_000} tankCapacityLiters={3} onBack={() => undefined} onSaved={() => undefined} />))
    await act(async () => enterAmount(container))
  }
  async function save() {
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await vi.waitFor(async () => expect(await listFuelEntries()).toHaveLength(1))
    })
  }

  it('renders and saves immediately through cold start, recovers in background and leaves the saved estimate unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) =>
      init.signal?.addEventListener('abort', () => reject(new Error('timeout'))))).mockResolvedValue(response()))
    await open()
    expect(container.textContent).toContain('Preço de referência indisponível')
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false)
    await save()
    const before = await listFuelEntries()
    expect(before[0].estimatedLiters).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(90_000))
    await act(async () => expandReference(container))
    expect(container.textContent?.replace(/\u00a0/g, ' ')).toContain('Preço de referência: R$ 7,05/L')
    expect(container.textContent).toContain('2026-10-04 a 2026-10-10')
    expect(await listFuelEntries()).toEqual(before)
  })

  it('updates after a five-second response and saves liters from the unrounded mean', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => setTimeout(() => resolve(response()), 5_000))))
    await open()
    expect(container.textContent).toContain('Preço de referência indisponível')
    await act(async () => vi.advanceTimersByTimeAsync(5_000))
    await act(async () => expandReference(container))
    expect(container.textContent).toContain('ANP · Paragominas')
    await save()
    expect((await listFuelEntries())[0]).toMatchObject({
      amountCents: 2_000, estimatedLiters: 2.836, referencePricePerLiter: 7.053,
      referenceWeekStart: '2026-10-04', referenceWeekEnd: '2026-10-10',
    })
  })

  it('uses valid cache offline then clears the visible reference on expiry', async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 59))
    localStorage.setItem(KEY, JSON.stringify({ reference, fetchedAt: new Date().toISOString(), nextCheckAt: null }))
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await open()
    await act(async () => expandReference(container))
    expect(container.textContent).toContain('ANP · Paragominas')
    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(container.textContent).toContain('Preço de referência indisponível')
    expect(container.textContent).not.toContain('ANP · Paragominas')
    expect(fetcher).not.toHaveBeenCalled()
    await save()
    expect((await listFuelEntries())[0].estimatedLiters).toBeNull()
  })

  it('opens and records offline with no cache, then displays the price when online', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    await open()
    await save()
    expect((await listFuelEntries())[0].estimatedLiters).toBeNull()
    online.mockReturnValue(true)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => expandReference(container))
    expect(container.textContent).toContain('ANP · Paragominas')
    expect((await listFuelEntries())[0].estimatedLiters).toBeNull()
  })
})
