export type VehicleView = 'home' | 'odometer' | 'fuel' | 'history'

const paths: Record<VehicleView, string> = {
  home: '/', odometer: '/hodometro', fuel: '/abastecer', history: '/historico',
}

export function currentView(): VehicleView {
  if (typeof window === 'undefined') return 'home'
  return (Object.keys(paths) as VehicleView[]).find((view) => paths[view] === location.pathname) ?? 'home'
}

export function initializeNavigation() {
  if (!Number.isInteger(history.state?.controlVaultDepth)) {
    history.replaceState({ ...history.state, controlVaultDepth: 0 }, '', paths[currentView()])
  }
}

export function navigateTo(view: VehicleView) {
  if (currentView() === view) return
  history.pushState({ controlVaultDepth: (history.state?.controlVaultDepth ?? 0) + 1 }, '', paths[view])
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function backToPreviousView() {
  if ((history.state?.controlVaultDepth ?? 0) > 0) {
    history.back()
  } else {
    history.replaceState({ controlVaultDepth: 0 }, '', paths.home)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
