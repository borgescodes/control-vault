// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  backToPreviousView,
  currentFuelEntryId,
  currentTripId,
  currentView,
  initializeNavigation,
  navigateTo,
} from './navigation'

describe('native vehicle navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    window.history.replaceState(null, '', '/')
  })

  it('starts every routed screen at the top', () => {
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined)

    initializeNavigation()
    navigateTo('history')

    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    })
  })

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

  it('routes saved trips through list, detail and edit paths', () => {
    initializeNavigation()
    navigateTo('trips')
    expect(location.pathname).toBe('/percursos')
    expect(currentView()).toBe('trips')

    navigateTo('trip-detail', 'trip-123')
    expect(location.pathname).toBe('/percursos/trip-123')
    expect(currentView()).toBe('trip-detail')
    expect(currentTripId()).toBe('trip-123')

    navigateTo('trip-edit', 'trip-123')
    expect(location.pathname).toBe('/percursos/trip-123/editar')
    expect(currentView()).toBe('trip-edit')
    expect(currentTripId()).toBe('trip-123')
  })

  it('creates a dedicated new-trip path without treating novo as an id', () => {
    initializeNavigation()
    navigateTo('trip-new')

    expect(location.pathname).toBe('/percursos/novo')
    expect(currentView()).toBe('trip-new')
    expect(currentTripId()).toBeNull()
  })

  it('routes fuel correction with an encoded stable id', () => {
    initializeNavigation()
    navigateTo('fuel-edit', 'fuel / 123')

    expect(location.pathname).toBe(
      '/historico/abastecimentos/fuel%20%2F%20123/editar',
    )
    expect(currentView()).toBe('fuel-edit')
    expect(currentFuelEntryId()).toBe('fuel / 123')
  })

  it('routes settings as a primary destination', () => {
    history.replaceState(null, '', '/configuracoes')
    initializeNavigation()

    expect(currentView()).toBe('settings')
  })

  it('keeps tank capacity secondary but directly addressable', () => {
    history.replaceState(null, '', '/tanque')
    initializeNavigation()

    expect(currentView()).toBe('tank-capacity')
    expect(currentFuelEntryId()).toBeNull()
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

  it('keeps direct trip details addressable and falls back home on back', () => {
    history.replaceState(null, '', '/percursos/abc')
    initializeNavigation()
    expect(currentView()).toBe('trip-detail')
    expect(currentTripId()).toBe('abc')

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
