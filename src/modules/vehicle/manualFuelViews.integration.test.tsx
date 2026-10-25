// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../infrastructure/sync/sync', () => ({
  syncCurrentSessionIfOnline: async () => undefined,
}))
import { resetLocalDatabase } from '../../infrastructure/local/db'
import { listFuelEntries } from '../../infrastructure/local/store'
import FuelView from './FuelView'
import { initializeVehicle } from './vehicleActions'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
describe('manual pump liters, fully offline', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(async () => {
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
    await resetLocalDatabase()
  })
  async function open() {
    await act(async () => root.render(
      <FuelView currentOdometerKm={1_000} tankCapacityLiters={3}
        onBack={() => undefined} onSaved={() => undefined} />,
    ))
  }
  it('records 0.910 L for R$ 7.00 without contacting ANP', async () => {
    const fetcher = vi.fn(() => { throw new Error('Unexpected HTTP request') })
    vi.stubGlobal('fetch', fetcher)
    await open()
    await act(async () => {
      setInputValue(container.querySelector('input[name="amount"]') as HTMLInputElement, '700')
      setInputValue(container.querySelector('input[name="liters"]') as HTMLInputElement, '0,910')
    })
    expect(container.textContent?.replace(/\u00a0/g, ' ')).toContain('R$ 7,69/L')
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    const entries = await listFuelEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      liters: 0.91, amountCents: 700, estimatedLiters: null,
      referencePricePerLiter: null, syncStatus: 'pending',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('allows the 0.5 L pump margin while blocking more than 3.5 L', async () => {
    await open()
    const amount = container.querySelector('input[name="amount"]') as HTMLInputElement
    const liters = container.querySelector('input[name="liters"]') as HTMLInputElement
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    await act(async () => setInputValue(amount, '700'))
    expect(submit.disabled).toBe(true)
    await act(async () => setInputValue(liters, '3,110'))
    expect(submit.disabled).toBe(false)
    await act(async () => setInputValue(liters, '3,500'))
    expect(submit.disabled).toBe(false)
    await act(async () => setInputValue(liters, '3,501'))
    expect(submit.disabled).toBe(true)
    expect(container.textContent).toContain('3,5 L')
    await act(async () => setInputValue(liters, '0,910'))
    expect(submit.disabled).toBe(false)
  })
})
