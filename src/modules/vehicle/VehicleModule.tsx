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
  const hasPending = vehicleState.syncStatus === 'pending' || readings.some((record) => record.syncStatus === 'pending') || fuelEntries.some((record) => record.syncStatus === 'pending')

  const navigation = (
    <nav className="vehicle-navigation" aria-label="Navegação principal">
      <button
        aria-current={view === 'home' ? 'page' : undefined}
        onClick={() => openView('home')}
        type="button"
      >
        <VehicleIcon name="home" />
        <span>Início</span>
      </button>
      <button
        aria-current={view === 'history' ? 'page' : undefined}
        onClick={() => openView('history')}
        type="button"
      >
        <VehicleIcon name="history" />
        <span>Histórico</span>
      </button>
    </nav>
  )

  if (view === 'odometer' || view === 'fuel') {
    const EntryView = view === 'fuel' ? FuelView : OdometerView
    return <>
      <EntryView currentOdometerKm={dashboard.odometerKm} onBack={backToPreviousView}
        onSaved={() => handleSaved(view === 'fuel' ? 'Abastecimento salvo' : 'Hodômetro atualizado')} />
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

  return (
    <>
      <HomeView
        dashboard={dashboard}
        notice={notice ? `${notice} localmente${hasPending ? ' · sincronização pendente' : ' · sincronizado'}` : null}
        onFuel={() => openView('fuel')}
        onOdometer={() => openView('odometer')}
      />
      {navigation}
    </>
  )
}
