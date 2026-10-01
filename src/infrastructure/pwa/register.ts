import { registerSW } from 'virtual:pwa-register'

export function registerPwa(onAvailable: (available: boolean) => void) {
  let registration: ServiceWorkerRegistration | undefined
  let timer: number | undefined
  let active = true
  const updateSW = 'serviceWorker' in navigator ? registerSW({
    immediate: true,
    onNeedRefresh() { if (active) onAvailable(true) },
    onRegisteredSW(_url, nextRegistration) { registration = nextRegistration },
    onRegisterError() { console.warn('[Control Vault PWA] Não foi possível registrar o modo offline') },
  }) : undefined
  const check = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (navigator.onLine) void registration?.update().catch(() => {
        console.warn('[Control Vault PWA] Verificação de atualização pendente')
      })
    }, 60)
  }
  const visible = () => { if (document.visibilityState === 'visible') check() }
  window.addEventListener('focus', check)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', visible)
  return {
    update: async () => { await updateSW?.(true) },
    dispose() {
      active = false
      window.clearTimeout(timer)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', visible)
    },
  }
}
