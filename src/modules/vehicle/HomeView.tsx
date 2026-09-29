import type { VehicleDashboard } from './selectors'

type HomeViewProps = {
  dashboard: VehicleDashboard
  now: Date
  onFuel: () => void
  onHistory: () => void
  onHome: () => void
  onOdometer: () => void
}

const integer = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
})
const decimal = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' })

const calibrationLabels = {
  calibrating: 'Calibrando',
  estimated: 'Estimado',
  calibrated: 'Calibrado',
} as const

export default function HomeView({
  dashboard,
  now,
  onFuel,
  onHistory,
  onHome,
  onOdometer,
}: HomeViewProps) {
  return (
    <section className="home" aria-labelledby="range-title">
      <div className="home__range">
        <h2 id="range-title">Autonomia</h2>
        <p
          className={
            dashboard.rangeKm !== null
              ? 'home__range-value'
              : 'home__range-empty'
          }
        >
          {dashboard.rangeKm !== null
            ? `${integer.format(dashboard.rangeKm)} km`
            : 'Calibrando'}
        </p>

        {dashboard.rangeKm !== null && dashboard.fuelPercent !== null && (
          <div className="home__fuel-state">
            <p
              aria-label={`Combustível estimado: ${integer.format(dashboard.fuelPercent)}%`}
              className="home__fuel-percent"
            >
              {integer.format(dashboard.fuelPercent)}%
            </p>
            <p className={`home__calibration home__calibration--${dashboard.calibrationState}`}>
              {calibrationLabels[dashboard.calibrationState]}
            </p>
          </div>
        )}
      </div>

      <dl className="home__metrics">
        <div>
          <dt>Consumo</dt>
          <dd>
            {dashboard.consumptionKmPerLiter === null
              ? 'Calibrando'
              : `${decimal.format(dashboard.consumptionKmPerLiter)} km/L`}
          </dd>
        </div>
        <div>
          <dt>Hodômetro</dt>
          <dd>{decimal.format(dashboard.odometerKm)} km</dd>
        </div>
        <div>
          <dt className="home__month">{month.format(now)}</dt>
          <dd>{currency.format(dashboard.monthSpendCents / 100)}</dd>
        </div>
      </dl>

      <div className="home__actions" aria-label="Ações rápidas">
        <button onClick={onOdometer} type="button">
          Atualizar KM
        </button>
        <button onClick={onFuel} type="button">
          Abastecer
        </button>
      </div>

      <nav className="home__navigation" aria-label="Navegação principal">
        <button aria-current="page" onClick={onHome} type="button">
          Início
        </button>
        <button onClick={onHistory} type="button">
          Histórico
        </button>
      </nav>
    </section>
  )
}
