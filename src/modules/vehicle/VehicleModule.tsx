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
    return <div className="vehicle-module" aria-busy="true" />
  }

  if (error) {
    return (
      <div className="vehicle-module">
        <p role="alert">{error}</p>
      </div>
    )
  }

  if (!vehicleState) {
    return (
      <div className="vehicle-module">
        <SetupView onComplete={refresh} />
      </div>
    )
  }

  if (view === 'odometer') {
    return (
      <div className="vehicle-module">
        <OdometerView
          onBack={() => setView('home')}
          onSaved={handleSaved}
        />
      </div>
    )
  }

  if (view === 'fuel') {
    return (
      <div className="vehicle-module">
        <FuelView onBack={() => setView('home')} onSaved={handleSaved} />
      </div>
    )
  }

  if (view === 'history') {
    return (
      <div className="vehicle-module">
        <HistoryView
          fuelEntries={fuelEntries}
          odometerReadings={readings}
          onBack={() => setView('home')}
        />
      </div>
    )
  }

  const now = new Date()
  const dashboard = getVehicleDashboard(
    vehicleState,
    readings,
    fuelEntries,
    now,
  )

  return (
    <div className="vehicle-module">
      <HomeView
        dashboard={dashboard}
        now={now}
        onFuel={() => setView('fuel')}
        onHistory={() => setView('history')}
        onHome={() => setView('home')}
        onOdometer={() => setView('odometer')}
      />
    </div>
  )
}
