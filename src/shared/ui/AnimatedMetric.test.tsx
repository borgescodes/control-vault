// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AnimatedMetric from './AnimatedMetric'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('AnimatedMetric', () => {
  let frame: FrameRequestCallback | null
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    frame = null
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frame = callback
        return 1
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(performance, 'now').mockReturnValue(0)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('ports the 880ms cubic ease-out count-up', async () => {
    await act(async () => {
      root.render(
        <AnimatedMetric format={(value) => String(Math.round(value))} value={100} />,
      )
    })

    expect(container.textContent).toBe('0')
    expect(requestAnimationFrame).toHaveBeenCalledOnce()

    await act(async () => frame?.(440))
    expect(container.textContent).toBe('88')

    await act(async () => frame?.(880))
    expect(container.textContent).toBe('100')
  })

  it('restarts once when the metric value changes', async () => {
    const view = (value: number) => (
      <AnimatedMetric format={(next) => String(Math.round(next))} value={value} />
    )

    await act(async () => root.render(view(100)))
    await act(async () => frame?.(880))
    expect(container.textContent).toBe('100')

    await act(async () => root.render(view(200)))
    expect(container.textContent).toBe('0')
    await act(async () => frame?.(880))
    expect(container.textContent).toBe('200')
  })

  it('renders the final value immediately for reduced motion', async () => {
    await act(async () => {
      root.render(
        <AnimatedMetric
          format={(value) => `${Math.round(value)} km`}
          reducedMotion
          value={108}
        />,
      )
    })

    expect(container.textContent).toBe('108 km')
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })
})
