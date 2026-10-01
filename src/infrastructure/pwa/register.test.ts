// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
const worker = vi.hoisted(() => ({ registerSW: vi.fn() }))
vi.mock('virtual:pwa-register', () => worker)
import { registerPwa } from './register'
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('worker lifecycle', () => {
  it('checks updates on coalesced focus/online/visible resume and cleans listeners', async () => {
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: {} })
    const update = vi.fn().mockResolvedValue(undefined)
    const activate = vi.fn().mockResolvedValue(undefined)
    worker.registerSW.mockImplementation((options) => { options.onRegisteredSW('/sw.js', { update }); return activate })
    const available = vi.fn()
    const control = registerPwa(available)
    window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online'))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(update).toHaveBeenCalledOnce()
    expect(activate).not.toHaveBeenCalled()
    await control.update()
    expect(activate).toHaveBeenCalledWith(true)
    control.dispose()
    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(update).toHaveBeenCalledOnce()
  })
})
