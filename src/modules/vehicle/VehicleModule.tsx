import { useEffect, useState } from 'react'

import {
  getVehicleState,
  listFuelEntries,
  listOdometerReadings,
} from '../../infrastructure/local/store'
import type {
  LocalFuelEntry,
  LocalOdometerReading,
  LocalVehicleState,
} from '../../infrastructure/local/db'
import OutlineIcon from '../../shared/ui/OutlineIcon'
import FuelView from './FuelView'
import HistoryView from './HistoryView'
import HomeView from './HomeView'
import OdometerView from './OdometerView'
import { getVehicleDashboard } from './selectors'
import SetupView from './SetupView'

type View = 'home' | 'odometer' | 'fuel' | 'history'

export default function VehicleModule() {
  const [view, setView] = useState<View>('home')
  const [vehicleState, setVehicleState] = useState<
    LocalVehicleState | null | undefined
  >(undefined)
  const [readings, setReadings] = useState<LocalOdometerReading[]>([])
  const [fuelEntries, setFuelEntries] = useState<LocalFuelEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    const [state, nextReadings, nextFuelEntries] = await Promise.all([
      getVehicleState(),
      listOdometerReadings(),
      listFuelEntries(),
    ])
    setVehicleState(state)
    setReadings(nextReadings)
    setFuelEntries(nextFuelEntries)
  }

  useEffect(() => {
    void refresh().catch(() => {
      setError('Falha ao carregar')
      setVehicleState(null)
    })
  }, [])

  useEffect(() => {
    if (!vehicleState) return
    document
      .querySelector<HTMLElement>('[data-view-root="true"]')
      ?.focus()
  }, [vehicleState, view])

  async function handleSaved(message: string) {
    await refresh()
    setNotice(message)
    setView('home')
  }

  function openView(nextView: View) {
    if (nextView !== 'home') setNotice(null)
    setView(nextView)
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

  if (view === 'odometer') {
    return (
      <OdometerView
        currentOdometerKm={dashboard.odometerKm}
        onBack={() => openView('home')}
        onSaved={() => handleSaved('Hodômetro atualizado')}
      />
    )
  }

  if (view === 'fuel') {
    return (
      <FuelView
        currentOdometerKm={dashboard.odometerKm}
        onBack={() => openView('home')}
        onSaved={() => handleSaved('Abastecimento salvo')}
      />
    )
  }

  const navigation = (
    <nav className="vehicle-navigation" aria-label="Navegação principal">
      <button
        aria-current={view === 'home' ? 'page' : undefined}
        onClick={() => openView('home')}
        type="button"
      >
        <OutlineIcon name="home" />
        <span>Início</span>
      </button>
      <button
        aria-current={view === 'history' ? 'page' : undefined}
        onClick={() => openView('history')}
        type="button"
      >
        <OutlineIcon name="history" />
        <span>Histórico</span>
      </button>
    </nav>
  )

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
        notice={notice}
        onFuel={() => openView('fuel')}
        onOdometer={() => openView('odometer')}
      />
      {navigation}
    </>
  )
}
