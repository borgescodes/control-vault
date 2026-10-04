import { useEffect, useState } from 'react'

import {
  getVehicleState,
  listAllSavedTrips,
  listFuelEntries,
  listOdometerReadings,
  subscribeToLocalChanges,
} from '../../infrastructure/local/store'
import type {
  LocalFuelEntry,
  LocalOdometerReading,
  LocalSavedTrip,
  LocalVehicleState,
} from '../../infrastructure/local/db'
import {
  getFuelPriceReference,
  type FuelPriceReference,
} from '../../infrastructure/fuelPrice/fuelPrice'
import {
  canOfferStatusNotification,
  clearStatusNotification,
  enableStatusNotification,
  isStatusNotificationEnabled,
  updateStatusNotification,
  type StatusNotificationSnapshot,
} from '../../infrastructure/pwa/statusNotification'
import VehicleIcon from '../../shared/ui/VehicleIcon'
import FuelView from './FuelView'
import HistoryView from './HistoryView'
import HomeView from './HomeView'
import OdometerView from './OdometerView'
import { getVehicleDashboard } from './selectors'
import SetupView from './SetupView'
import TripDetailView from './TripDetailView'
import TripFormView from './TripFormView'
import TripsView from './TripsView'
import {
  backToPreviousView,
  currentTripId,
  currentView,
  initializeNavigation,
  navigateTo,
  replaceTo,
  type VehicleView,
} from './navigation'

function isTripView(view: VehicleView): boolean {
  return view === 'trips' || view === 'trip-new' || view === 'trip-detail' || view === 'trip-edit'
}

export default function VehicleModule() {
  const [view, setView] = useState<VehicleView>(currentView)
  const [vehicleState, setVehicleState] = useState<
    LocalVehicleState | null | undefined
  >(undefined)
  const [readings, setReadings] = useState<LocalOdometerReading[]>([])
  const [fuelEntries, setFuelEntries] = useState<LocalFuelEntry[]>([])
  const [savedTrips, setSavedTrips] = useState<LocalSavedTrip[]>([])
  const [tripPriceReference, setTripPriceReference] = useState<FuelPriceReference | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [statusNotificationEnabled, setStatusNotificationEnabled] = useState(
    () => isStatusNotificationEnabled(),
  )
  const [statusNotificationAvailable, setStatusNotificationAvailable] = useState(
    () => canOfferStatusNotification(),
  )
  const vehicleReady = Boolean(vehicleState)

  useEffect(() => {
    initializeNavigation()
    const handlePopState = () => { setView(currentView()) }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  async function refresh() {
    const [state, nextReadings, nextFuelEntries, nextTrips] = await Promise.all([
      getVehicleState(),
      listOdometerReadings(),
      listFuelEntries(),
      listAllSavedTrips(),
    ])
    setVehicleState(state)
    setReadings(nextReadings)
    setFuelEntries(nextFuelEntries)
    setSavedTrips(nextTrips)
  }

  useEffect(() => {
    let active = true
    const update = () => { if (active) void refresh().catch(() => {
      setError('Falha ao carregar')
      setVehicleState(null)
    }) }
    update()
    const unsubscribe = subscribeToLocalChanges(update)
    return () => { active = false; unsubscribe() }
  }, [])

  useEffect(() => {
    if (!vehicleReady || !isTripView(view)) return

    let active = true
    const applyRefresh = (reference: FuelPriceReference) => {
      if (active) setTripPriceReference(reference)
    }

    void getFuelPriceReference(new Date(), applyRefresh)
      .then((reference) => {
        if (active) setTripPriceReference(reference)
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [vehicleReady, view])

  useEffect(() => {
    if (!vehicleState || !statusNotificationEnabled) return

    const dashboard = getVehicleDashboard(
      vehicleState,
      readings,
      fuelEntries,
      new Date(),
    )
    const snapshot: StatusNotificationSnapshot | null =
      dashboard.rangeKm !== null && dashboard.fuelPercent !== null
        ? {
            rangeKm: dashboard.rangeKm,
            fuelPercent: dashboard.fuelPercent,
          }
        : null

    void (snapshot
      ? updateStatusNotification(snapshot)
      : clearStatusNotification()
    ).catch(() => undefined)
  }, [
    fuelEntries,
    readings,
    statusNotificationEnabled,
    vehicleState,
  ])

  useEffect(() => {
    if (!vehicleReady) return
    document
      .querySelector<HTMLElement>('[data-view-root="true"]')
      ?.focus()
  }, [vehicleReady, view])

  async function handleSaved(message: string) {
    await refresh()
    setNotice(message)
    backToPreviousView()
  }

  async function handleTripSaved(tripId: string) {
    await refresh()
    replaceTo('trip-detail', tripId)
  }

  async function handleTripDeleted() {
    await refresh()
    replaceTo('trips')
  }

  function openView(nextView: VehicleView) {
    if (nextView !== 'home') setNotice(null)
    navigateTo(nextView)
  }

  if (vehicleState === undefined) {
    return (
      <div aria-busy="true" aria-live="polite" className="vehicle-loading">
        Carregando
      </div>
    )
  }

  if (error) {
    return (
      <div className="vehicle-error">
        <p className="vehicle-alert" role="alert">{error}</p>
      </div>
    )
  }

  if (!vehicleState) {
    return <SetupView onComplete={refresh} />
  }

  const dashboard = getVehicleDashboard(
    vehicleState,
    readings,
    fuelEntries,
    new Date(),
  )
  const statusNotificationSnapshot: StatusNotificationSnapshot | null =
    dashboard.rangeKm !== null && dashboard.fuelPercent !== null
      ? {
          rangeKm: dashboard.rangeKm,
          fuelPercent: dashboard.fuelPercent,
        }
      : null

  async function handleEnableStatusNotification() {
    if (!statusNotificationSnapshot) return

    try {
      const enabled = await enableStatusNotification(
        statusNotificationSnapshot,
      )
      setStatusNotificationEnabled(enabled)
      setStatusNotificationAvailable(
        enabled ? true : canOfferStatusNotification(),
      )
    } catch {
      setStatusNotificationAvailable(canOfferStatusNotification())
    }
  }
  const visibleTrips = savedTrips.filter((trip) => trip.deletedAt === null)
  const hasPending =
    vehicleState.syncStatus === 'pending' ||
    readings.some((record) => record.syncStatus === 'pending') ||
    fuelEntries.some((record) => record.syncStatus === 'pending') ||
    savedTrips.some((record) => record.syncStatus === 'pending')
  const tripNavigationActive = isTripView(view)
  const tripId = currentTripId()
  const selectedTrip = tripId
    ? visibleTrips.find((trip) => trip.id === tripId) ?? null
    : null

  const navigation = (
    <nav className="vehicle-navigation" aria-label="Navegação principal">
      <button
        aria-label="Início"
        aria-current={view === 'home' ? 'page' : undefined}
        onClick={() => openView('home')}
        type="button"
      >
        <VehicleIcon name="home" />
      </button>
      <button
        aria-label="Percursos"
        aria-current={tripNavigationActive ? 'page' : undefined}
        onClick={() => openView('trips')}
        type="button"
      >
        <VehicleIcon name="route" />
      </button>
      <button
        aria-label="Histórico"
        aria-current={view === 'history' ? 'page' : undefined}
        onClick={() => openView('history')}
        type="button"
      >
        <VehicleIcon name="history" />
      </button>
    </nav>
  )

  if (view === 'fuel') {
    return <>
      <FuelView
        currentOdometerKm={dashboard.odometerKm}
        onBack={backToPreviousView}
        onSaved={() => handleSaved('Abastecimento salvo')}
        tankCapacityLiters={vehicleState.nominalTankCapacityLiters}
      />
      {navigation}
    </>
  }

  if (view === 'odometer') {
    return <>
      <OdometerView
        currentOdometerKm={dashboard.odometerKm}
        onBack={backToPreviousView}
        onSaved={() => handleSaved('Hodômetro atualizado')}
      />
      {navigation}
    </>
  }

  if (view === 'history') {
    return (
      <>
        <HistoryView
          fuelEntries={fuelEntries}
          odometerReadings={readings}
        />
        {navigation}
      </>
    )
  }

  if (view === 'trips') {
    return (
      <>
        <TripsView
          consumptionKmPerLiter={dashboard.consumptionKmPerLiter}
          fuelPricePerLiter={tripPriceReference?.precoMedio ?? null}
          onNew={() => navigateTo('trip-new')}
          onOpen={(id) => navigateTo('trip-detail', id)}
          trips={visibleTrips}
        />
        {navigation}
      </>
    )
  }

  if (view === 'trip-new') {
    return (
      <>
        <TripFormView
          onBack={backToPreviousView}
          onSaved={(trip) => handleTripSaved(trip.id)}
        />
        {navigation}
      </>
    )
  }

  if (view === 'trip-detail' || view === 'trip-edit') {
    if (!selectedTrip) {
      return (
        <>
          <section
            className="vehicle-view trip-missing"
            data-view-root="true"
            tabIndex={-1}
          >
            <header className="view-header">
              <button
                aria-label="Voltar"
                className="view-back"
                onClick={backToPreviousView}
                type="button"
              >
                <VehicleIcon name="back" />
              </button>
              <div>
                <h2>Percurso indisponível</h2>
              </div>
            </header>
          </section>
          {navigation}
        </>
      )
    }

    if (view === 'trip-edit') {
      return (
        <>
          <TripFormView
            initialTrip={selectedTrip}
            onBack={backToPreviousView}
            onSaved={(trip) => handleTripSaved(trip.id)}
          />
          {navigation}
        </>
      )
    }

    return (
      <>
        <TripDetailView
          consumptionKmPerLiter={dashboard.consumptionKmPerLiter}
          fuelPricePerLiter={tripPriceReference?.precoMedio ?? null}
          onBack={backToPreviousView}
          onDeleted={handleTripDeleted}
          onEdit={() => navigateTo('trip-edit', selectedTrip.id)}
          trip={selectedTrip}
        />
        {navigation}
      </>
    )
  }

  return (
    <>
      <HomeView
        dashboard={dashboard}
        notice={notice ? `${notice} localmente${hasPending ? ' · sincronização pendente' : ' · sincronizado'}` : null}
        onEnableStatusNotification={
          statusNotificationAvailable &&
          !statusNotificationEnabled &&
          statusNotificationSnapshot
            ? () => void handleEnableStatusNotification()
            : undefined
        }
        onFuel={() => openView('fuel')}
        onOdometer={() => openView('odometer')}
      />
      {navigation}
    </>
  )
}
