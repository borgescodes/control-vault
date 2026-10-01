export type VehicleView =
  | 'home'
  | 'odometer'
  | 'fuel'
  | 'history'
  | 'trips'
  | 'trip-new'
  | 'trip-detail'
  | 'trip-edit'

const staticPaths: Partial<Record<VehicleView, string>> = {
  home: '/',
  odometer: '/hodometro',
  fuel: '/abastecer',
  history: '/historico',
  trips: '/percursos',
  'trip-new': '/percursos/novo',
}

function pathForView(view: VehicleView, tripId?: string | null): string {
  const staticPath = staticPaths[view]
  if (staticPath) return staticPath

  if (!tripId) {
    throw new Error('Trip id is required for this view')
  }

  const encoded = encodeURIComponent(tripId)
  return view === 'trip-edit'
    ? `/percursos/${encoded}/editar`
    : `/percursos/${encoded}`
}

export function currentTripId(): string | null {
  if (typeof window === 'undefined') return null
  const match = location.pathname.match(/^\/percursos\/([^/]+)(?:\/editar)?\/?$/)
  if (!match || match[1] === 'novo') return null

  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export function currentView(): VehicleView {
  if (typeof window === 'undefined') return 'home'

  for (const [view, path] of Object.entries(staticPaths)) {
    if (path === location.pathname) return view as VehicleView
  }

  if (/^\/percursos\/[^/]+\/editar\/?$/.test(location.pathname)) {
    return 'trip-edit'
  }
  if (/^\/percursos\/[^/]+\/?$/.test(location.pathname)) {
    return 'trip-detail'
  }

  return 'home'
}

export function initializeNavigation() {
  if (!Number.isInteger(history.state?.controlVaultDepth)) {
    const view = currentView()
    history.replaceState(
      { ...history.state, controlVaultDepth: 0 },
      '',
      pathForView(view, currentTripId()),
    )
  }
}

export function navigateTo(view: VehicleView, tripId?: string | null) {
  const nextPath = pathForView(view, tripId)
  if (location.pathname === nextPath) return

  history.pushState(
    { controlVaultDepth: (history.state?.controlVaultDepth ?? 0) + 1 },
    '',
    nextPath,
  )
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function backToPreviousView() {
  if ((history.state?.controlVaultDepth ?? 0) > 0) {
    history.back()
  } else {
    history.replaceState({ controlVaultDepth: 0 }, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
