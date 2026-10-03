// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  enableStatusNotification,
  formatStatusNotificationBody,
  isStatusNotificationEnabled,
  updateStatusNotification,
} from './statusNotification'

const snapshot = {
  rangeKm: 54.2,
  fuelPercent: 53.4,
}

describe('status notification', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('formats the compact body with non-breaking separators', () => {
    const body = formatStatusNotificationBody(snapshot)

    expect(body).toBe('54\u00a0km\u00a0•\u00a053%')
    expect(body).not.toContain(' ')
    expect(body).not.toContain('\n')
  })

  it('enables and updates one tagged silent notification', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined)
    const registration = {
      showNotification,
      getNotifications: vi.fn().mockResolvedValue([]),
    }

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    })
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
    })
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: window.Notification,
    })

    await expect(enableStatusNotification(snapshot)).resolves.toBe(true)
    expect(isStatusNotificationEnabled()).toBe(true)
    expect(showNotification).toHaveBeenLastCalledWith(
      '',
      expect.objectContaining({
        body: '54\u00a0km\u00a0•\u00a053%',
        badge: '/pwa-192.png',
        icon: '/notification-icon.svg',
        tag: 'control-vault-status',
        requireInteraction: true,
        silent: true,
        data: { url: '/' },
      }),
    )

    await updateStatusNotification({
      rangeKm: 80,
      fuelPercent: 75,
    })

    expect(showNotification).toHaveBeenCalledTimes(2)
    expect(showNotification).toHaveBeenLastCalledWith(
      '',
      expect.objectContaining({
        body: '80\u00a0km\u00a0•\u00a075%',
        tag: 'control-vault-status',
      }),
    )
  })
})
