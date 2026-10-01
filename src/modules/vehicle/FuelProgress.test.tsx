// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import FuelProgress from './FuelProgress'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })

it('keeps the actual fuel level while pausing its decorative loop offscreen, hidden and under reduced motion', async () => {
  let intersect: IntersectionObserverCallback = () => undefined
  let preference: (() => void) | undefined
  const media = { matches: false, addEventListener: vi.fn((_name, listener) => { preference = listener }), removeEventListener: vi.fn() }
  const disconnect = vi.fn()
  vi.stubGlobal('matchMedia', () => media)
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback }
    observe() {}
    disconnect = disconnect
  })
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<FuelProgress percent={50} />))
  const bar = container.querySelector('[role="progressbar"]')!
  expect(bar.getAttribute('aria-valuenow')).toBe('50')
  expect((bar.querySelector('.fuel-progress__value') as HTMLElement).style.width).toBe('50%')
  expect(bar.getAttribute('data-motion')).toBe('paused')
  await act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(bar.getAttribute('data-motion')).toBe('running')
  await act(async () => intersect([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(bar.getAttribute('data-motion')).toBe('paused')
  await act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(bar.getAttribute('data-motion')).toBe('paused')
  hidden.mockReturnValue(false)
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(bar.getAttribute('data-motion')).toBe('running')
  media.matches = true
  await act(async () => preference?.())
  expect(bar.getAttribute('data-motion')).toBe('paused')
  expect(bar.getAttribute('aria-valuenow')).toBe('50')
  await act(async () => root.render(<FuelProgress percent={0} />))
  expect(bar.getAttribute('data-motion')).toBe('paused')
  await act(async () => root.unmount())
  expect(disconnect).toHaveBeenCalled()
  expect(media.removeEventListener).toHaveBeenCalled()
})
