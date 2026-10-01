// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { backToPreviousView, currentView, initializeNavigation, navigateTo } from './navigation'

describe('native vehicle navigation', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); vi.restoreAllMocks() })
  it('creates real URLs and browser history for internal screens', () => {
    initializeNavigation()
    const initialLength = history.length
    navigateTo('history')
    navigateTo('fuel')
    expect(location.pathname).toBe('/abastecer')
    expect(currentView()).toBe('fuel')
    expect(history.length).toBe(initialLength + 2)
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined)
    backToPreviousView()
    expect(back).toHaveBeenCalledOnce()
  })
  it('returns direct entry to home instead of leaving the app', () => {
    history.replaceState(null, '', '/hodometro')
    initializeNavigation()
    expect(currentView()).toBe('odometer')
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined)
    backToPreviousView()
    expect(back).not.toHaveBeenCalled()
    expect(location.pathname).toBe('/')
  })
  it('does not add history entries for the already open screen', () => {
    initializeNavigation()
    const initialLength = history.length
    navigateTo('home')
    expect(history.length).toBe(initialLength)
  })
})
