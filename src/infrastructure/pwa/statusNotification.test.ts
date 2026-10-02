// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  enableStatusNotification,
  formatStatusNotificationBody,
  isStatusNotificationEnabled,
  updateStatusNotification,
} from './statusNotification'

const snapshot = {
  consumptionKmPerLiter: 36.74,
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

    expect(body).toBe('36,7\u00a0km/L\u00a0•\u00a054\u00a0km\u00a0•\u00a053%')
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
      'CONTROL VAULT',
      expect.objectContaining({
        body: '36,7\u00a0km/L\u00a0•\u00a054\u00a0km\u00a0•\u00a053%',
        icon: '/pwa-192.png',
        tag: 'control-vault-status',
        requireInteraction: true,
        renotify: false,
        silent: true,
        data: { url: '/' },
      }),
    )

    await updateStatusNotification({
      consumptionKmPerLiter: 40,
      rangeKm: 80,
      fuelPercent: 75,
    })

    expect(showNotification).toHaveBeenCalledTimes(2)
    expect(showNotification).toHaveBeenLastCalledWith(
      'CONTROL VAULT',
      expect.objectContaining({
        body: '40,0\u00a0km/L\u00a0•\u00a080\u00a0km\u00a0•\u00a075%',
        tag: 'control-vault-status',
      }),
    )
  })
})
