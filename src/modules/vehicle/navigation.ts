export type VehicleView =
  | 'home'
  | 'odometer'
  | 'fuel'
  | 'fuel-edit'
  | 'history'
  | 'settings'
  | 'tank-capacity'
  | 'trips'
  | 'trip-new'
  | 'trip-detail'
  | 'trip-edit'

const staticPaths: Partial<Record<VehicleView, string>> = {
  home: '/',
  odometer: '/hodometro',
  fuel: '/abastecer',
  history: '/historico',
  settings: '/configuracoes',
  'tank-capacity': '/tanque',
  trips: '/percursos',
  'trip-new': '/percursos/novo',
}

function pathForView(view: VehicleView, entityId?: string | null): string {
  const staticPath = staticPaths[view]
  if (staticPath) return staticPath

  if (!entityId) {
    throw new Error('Entity id is required for this view')
  }

  const encoded = encodeURIComponent(entityId)

  if (view === 'fuel-edit') {
    return `/historico/abastecimentos/${encoded}/editar`
  }

  return view === 'trip-edit'
    ? `/percursos/${encoded}/editar`
    : `/percursos/${encoded}`
}

export function currentFuelEntryId(): string | null {
  if (typeof window === 'undefined') return null
  const match = location.pathname.match(
    /^\/historico\/abastecimentos\/([^/]+)\/editar\/?$/,
  )
  if (!match) return null

  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
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

  if (/^\/historico\/abastecimentos\/[^/]+\/editar\/?$/.test(location.pathname)) {
    return 'fuel-edit'
  }
  if (/^\/percursos\/[^/]+\/editar\/?$/.test(location.pathname)) {
    return 'trip-edit'
  }
  if (/^\/percursos\/[^/]+\/?$/.test(location.pathname)) {
    return 'trip-detail'
  }

  return 'home'
}

function currentEntityId(view: VehicleView): string | null {
  if (view === 'fuel-edit') return currentFuelEntryId()
  if (view === 'trip-detail' || view === 'trip-edit') return currentTripId()
  return null
}

export function initializeNavigation() {
  if (!Number.isInteger(history.state?.controlVaultDepth)) {
    const view = currentView()
    history.replaceState(
      { ...history.state, controlVaultDepth: 0 },
      '',
      pathForView(view, currentEntityId(view)),
    )
  }
}

export function navigateTo(view: VehicleView, entityId?: string | null) {
  const nextPath = pathForView(view, entityId)
  if (location.pathname === nextPath) return

  history.pushState(
    { controlVaultDepth: (history.state?.controlVaultDepth ?? 0) + 1 },
    '',
    nextPath,
  )
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function replaceTo(view: VehicleView, entityId?: string | null) {
  history.replaceState(
    { ...history.state },
    '',
    pathForView(view, entityId),
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
