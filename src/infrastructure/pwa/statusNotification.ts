const STATUS_NOTIFICATION_KEY = 'control-vault.status-notification.enabled'
const STATUS_NOTIFICATION_TAG = 'control-vault-status'

export type StatusNotificationSnapshot = {
  consumptionKmPerLiter: number
  rangeKm: number
  fuelPercent: number
}

const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const integer = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
})

export function formatStatusNotificationBody({
  consumptionKmPerLiter,
  rangeKm,
  fuelPercent,
}: StatusNotificationSnapshot): string {
  const percent = Math.max(0, Math.min(100, fuelPercent))
  return [
    `${decimal.format(consumptionKmPerLiter)}\u00a0km/L`,
    `${integer.format(rangeKm)}\u00a0km`,
    `${integer.format(percent)}%`,
  ].join('\u00a0•\u00a0')
}

export function canOfferStatusNotification(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    Notification.permission !== 'denied'
  )
}

export function isStatusNotificationEnabled(): boolean {
  if (!canOfferStatusNotification()) return false
  return (
    Notification.permission === 'granted' &&
    window.localStorage.getItem(STATUS_NOTIFICATION_KEY) === '1'
  )
}

async function showStatusNotification(
  snapshot: StatusNotificationSnapshot,
): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification('CONTROL VAULT', {
    body: formatStatusNotificationBody(snapshot),
    badge: '/pwa-192.png',
    tag: STATUS_NOTIFICATION_TAG,
    requireInteraction: true,
    silent: true,
    data: { url: '/' },
  })
}

export async function enableStatusNotification(
  snapshot: StatusNotificationSnapshot,
): Promise<boolean> {
  if (!canOfferStatusNotification()) return false

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()

  if (permission !== 'granted') return false

  window.localStorage.setItem(STATUS_NOTIFICATION_KEY, '1')
  await showStatusNotification(snapshot)
  return true
}

export async function updateStatusNotification(
  snapshot: StatusNotificationSnapshot,
): Promise<void> {
  if (!isStatusNotificationEnabled()) return
  await showStatusNotification(snapshot)
}

export async function clearStatusNotification(): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  const notifications = await registration.getNotifications({
    tag: STATUS_NOTIFICATION_TAG,
  })
  for (const notification of notifications) notification.close()
}
