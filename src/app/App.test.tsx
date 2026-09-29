// @vitest-environment jsdom

import 'fake-indexeddb/auto'

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetLocalDatabase } from '../infrastructure/local/db'
import { saveHydratedVehicleData } from '../infrastructure/local/store'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function waitForSyncStart() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (syncStub.runSync.mock.calls.length > 0) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error('Timed out waiting for sync')
}

async function waitForText(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.textContent?.includes(text)) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error(`Timed out waiting for ${text}`)
}

const authStub = vi.hoisted(() => ({
  getCachedSession: vi.fn(),
  signOut: vi.fn(),
  subscribeToAuth: vi.fn(() => () => undefined),
}))
const syncStub = vi.hoisted(() => ({ runSync: vi.fn() }))

vi.mock('../infrastructure/auth/session', () => authStub)
vi.mock('../infrastructure/sync/sync', () => syncStub)

import App from './App'

describe('App', () => {
  afterEach(async () => {
    document.body.innerHTML = ''
    await resetLocalDatabase()
    vi.clearAllMocks()
  })

  it('renders the Control Vault shell', () => {
    expect(renderToStaticMarkup(createElement(App))).toContain('<h1>Control Vault</h1>')
  })

  it('shows hydrated vehicle data without a manual reload', async () => {
    let finishHydration: () => void = () => {}
    const hydrationGate = new Promise<void>((resolve) => {
      finishHydration = resolve
    })
    authStub.getCachedSession.mockResolvedValue({
      user: { id: '11111111-1111-4111-8111-111111111111' },
    })
    syncStub.runSync.mockImplementation(async () => {
      await hydrationGate
      await saveHydratedVehicleData({
        vehicleState: {
          tankCapacityLiters: 3,
          initialOdometerKm: 1_000,
          initialFullTankAt: '2026-09-29T10:00:00.000Z',
          createdAt: '2026-09-29T10:00:00.000Z',
          updatedAt: '2026-09-29T10:00:00.000Z',
        },
        odometerReadings: [],
        fuelEntries: [],
      })
      return { synced: 0, pending: 0, failed: 0 }
    })

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<App />)
    })
    await waitForSyncStart()
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

    await act(async () => {
      finishHydration()
    })
    await waitForText(container, 'Autonomia')

    expect(container.textContent).toContain('Autonomia')
    expect(container.textContent).not.toContain('Começar')
    await act(async () => root.unmount())
  })
})
