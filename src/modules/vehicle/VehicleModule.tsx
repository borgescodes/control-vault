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
import OdometerView from './OdometerView'
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
    return null
  }

  if (error) {
    return <p role="alert">{error}</p>
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

  if (view === 'history') {
    return (
      <HistoryView
        fuelEntries={fuelEntries}
        odometerReadings={readings}
        onBack={() => setView('home')}
      />
    )
  }

  return (
    <section>
      <button onClick={() => setView('odometer')} type="button">
        Atualizar KM
      </button>
      <button onClick={() => setView('fuel')} type="button">
        Abastecer
      </button>
      <button onClick={() => setView('history')} type="button">
        Histórico
      </button>
    </section>
  )
}
