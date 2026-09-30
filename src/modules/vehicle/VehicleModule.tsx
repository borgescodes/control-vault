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

  async function handleSaved() {
    await refresh()
    setView('home')
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

  if (view === 'odometer') {
    return (
      <OdometerView
        onBack={() => setView('home')}
        onSaved={handleSaved}
      />
    )
  }

  if (view === 'fuel') {
    return (
      <FuelView onBack={() => setView('home')} onSaved={handleSaved} />
    )
  }

  const navigation = (
    <nav className="vehicle-navigation" aria-label="Navegação principal">
      <button
        aria-current={view === 'home' ? 'page' : undefined}
        onClick={() => setView('home')}
        type="button"
      >
        Início
      </button>
      <button
        aria-current={view === 'history' ? 'page' : undefined}
        onClick={() => setView('history')}
        type="button"
      >
        Histórico
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

  const dashboard = getVehicleDashboard(
    vehicleState,
    readings,
    fuelEntries,
    new Date(),
  )

  return (
    <>
      <HomeView
        dashboard={dashboard}
        onFuel={() => setView('fuel')}
        onOdometer={() => setView('odometer')}
      />
      {navigation}
    </>
  )
}
