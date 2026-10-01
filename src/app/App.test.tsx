// @vitest-environment jsdom

import 'fake-indexeddb/auto'

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetLocalDatabase } from '../infrastructure/local/db'
import { claimSyncOwner, saveHydratedVehicleData } from '../infrastructure/local/store'

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
  signIn: vi.fn(),
  signOut: vi.fn(),
  subscribeToAuth: vi.fn((_listener: (session: { user: { id: string } } | null) => void) => () => undefined),
}))
const syncStub = vi.hoisted(() => ({
  runSync: vi.fn(),
  subscribeToSyncActivity: vi.fn((listener: (activity: 'idle' | 'syncing') => void) => {
    listener('idle')
    return () => undefined
  }),
}))

vi.mock('../infrastructure/auth/session', () => authStub)
vi.mock('../infrastructure/sync/sync', () => syncStub)
vi.mock('../infrastructure/pwa/register', () => ({
  registerPwa: () => ({ update: async () => undefined, dispose: () => undefined }),
}))

import App from './App'
import LoginView from './LoginView'

describe('App', () => {
  afterEach(async () => {
    document.body.innerHTML = ''
    await resetLocalDatabase()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  it('renders the distilled Control Vault shell without Credit Monitor branding', () => {
    const markup = renderToStaticMarkup(createElement(App))

    expect(markup).toContain('class="app__shell"')
    expect(markup).toContain('class="app__header"')
    expect(markup).toContain('<h1>CONTROL VAULT</h1>')
    expect(markup).not.toContain('lcm-brand-mark')
    expect(markup).not.toContain('Vehicle')
  })

  it('keeps authentication minimal', () => {
    const markup = renderToStaticMarkup(createElement(LoginView))

    expect(markup).toContain('class="auth-form"')
    expect(markup).toContain('aria-labelledby="login-title"')
    expect(markup).toContain('data-view-root="true"')
    expect(markup).toContain('>Email<')
    expect(markup).toContain('>Senha<')
    expect(markup).toContain('>Entrar<')
    expect(markup).not.toContain('Cadastrar')
    expect(markup).not.toContain('Redefinir')
    expect(markup).not.toContain('Google')
  })

  it('announces login progress on the submit action', async () => {
    let finishSignIn: () => void = () => undefined
    authStub.signIn.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishSignIn = resolve
      }),
    )
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<LoginView />))
    const inputs = container.querySelectorAll('input')
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set

    await act(async () => {
      setValue?.call(inputs[0], 'owner@example.com')
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
      setValue?.call(inputs[1], 'secret')
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
      container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })

    const submit = container.querySelector('button[type="submit"]')
    expect(submit?.getAttribute('aria-busy')).toBe('true')
    expect(submit?.textContent).toContain('Entrando')

    await act(async () => finishSignIn())
    await act(async () => root.unmount())
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
          nominalTankCapacityLiters: 3,
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
    await waitForText(container, 'Tanque')

    expect(container.textContent).toContain('Tanque')
    expect(container.textContent).toContain('100%')
    expect(container.textContent).not.toContain('Configurar veículo')
    await act(async () => root.unmount())
  })

  it('retries on focus and visible resume without showing ON after failure', async () => {
    authStub.getCachedSession.mockResolvedValue({ user: { id: '11111111-1111-4111-8111-111111111111' } })
    syncStub.runSync.mockRejectedValue(new Error('unavailable'))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<App />))
    await waitForSyncStart()
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)))
    expect(container.querySelector('[role="status"]')?.textContent).toContain('SYNC')
    expect(container.textContent).toContain('Sincronização não concluída')
    const before = syncStub.runSync.mock.calls.length
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
    expect(syncStub.runSync.mock.calls.length).toBe(before + 1)
    await act(async () => root.unmount())
  })

  it.each([true, false])('does not expose another owner database with online=%s', async (online) => {
    vi.stubGlobal('navigator', { onLine: online })
    await claimSyncOwner('original-owner')
    authStub.getCachedSession.mockResolvedValue({ user: { id: 'different-owner' } })
    syncStub.runSync.mockResolvedValue({ synced: 0, pending: 0, failed: 0 })
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<App />))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)))
    expect(container.textContent).toContain('outra conta')
    expect(container.querySelector('.vehicle-view, .home')).toBeNull()
    expect(syncStub.runSync).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })

  it('preserves a form when the same user session token refreshes', async () => {
    const session = { user: { id: '11111111-1111-4111-8111-111111111111' } }
    authStub.getCachedSession.mockResolvedValue(session)
    syncStub.runSync.mockResolvedValue({ synced: 0, pending: 0, failed: 0 })
    let notify: (nextSession: typeof session | null) => void = () => undefined
    authStub.subscribeToAuth.mockImplementationOnce((listener) => { notify = listener; return () => undefined })
    await saveHydratedVehicleData({ vehicleState: { nominalTankCapacityLiters: 3, initialOdometerKm: 1000, initialFullTankAt: null, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' }, odometerReadings: [], fuelEntries: [] })
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<App />))
    await waitForText(container, 'Atualizar KM')
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Atualizar KM'))?.click())
    const input = container.querySelector('input[name="odometer"]') as HTMLInputElement
    input.focus()
    await act(async () => { notify({ ...session }); await new Promise((resolve) => setTimeout(resolve, 100)) })
    expect(container.querySelector('input[name="odometer"]')).toBe(input)
    expect(document.activeElement).toBe(input)
    await act(async () => root.unmount())
  })
})
