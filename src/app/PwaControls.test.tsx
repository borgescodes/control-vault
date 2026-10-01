// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pwa = vi.hoisted(() => ({ registerPwa: vi.fn(() => ({ update: vi.fn(), dispose: vi.fn() })) }))
vi.mock('../infrastructure/pwa/register', () => pwa)
import PwaControls from './PwaControls'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })

async function mount() {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<PwaControls />))
  return { container, root }
}

describe('PWA controls', () => {
  it('offers installation only after a prompt and consumes the event once', async () => {
    const { container, root } = await mount()
    expect(container.textContent).not.toContain('Instalar app')
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'dismissed' }),
    })
    await act(async () => window.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    await act(async () => container.querySelector('button')?.click())
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(container.textContent).not.toContain('Instalar app')
    await act(async () => root.unmount())
  })

  it('hides installation in standalone and after appinstalled', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    const { container, root } = await mount()
    await act(async () => window.dispatchEvent(new Event('beforeinstallprompt')))
    expect(container.textContent).not.toContain('Instalar app')
    await act(async () => root.unmount())
  })

  it('offers iOS instructions on request without permanently showing them', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari')
    const { container, root } = await mount()
    expect(container.textContent).toContain('Instalar app')
    expect(container.textContent).not.toContain('Adicionar à Tela de Início')
    await act(async () => container.querySelector('button')?.click())
    expect(container.textContent).toContain('Adicionar à Tela de Início')
    await act(async () => root.unmount())
  })

  it('prompts before activating a worker update', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    pwa.registerPwa.mockImplementationOnce((notify?: (available: boolean) => void) => {
      notify?.(true)
      return { update, dispose: vi.fn() }
    })
    const { container, root } = await mount()
    expect(update).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Atualizar app')
    await act(async () => container.querySelector('button')?.click())
    expect(update).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
  })
})
