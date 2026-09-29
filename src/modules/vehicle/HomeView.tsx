import type { VehicleDashboard } from './selectors'
import AnimatedMetric from '../../shared/ui/AnimatedMetric'
import Icon from '../../shared/ui/Icon'

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
  const ready = dashboard.rangeState === 'ready' && dashboard.rangeKm !== null
  const rangeLabel = dashboard.rangeState === 'awaiting_full_tank'
    ? 'Aguardando tanque cheio'
    : 'Calibrando'
  const status = dashboard.rangeState === 'awaiting_full_tank'
    ? 'unavailable'
    : ready
      ? dashboard.calibrationState
      : 'calibrating'
  const statusLabel = dashboard.rangeState === 'awaiting_full_tank'
    ? 'Sem âncora'
    : ready
      ? calibrationLabels[dashboard.calibrationState]
      : 'Calibrando'
  const fuelPercent = dashboard.fuelPercent === null
    ? null
    : Math.max(0, Math.min(100, dashboard.fuelPercent))

  return (
    <section className="home" aria-labelledby="range-title">
      <div className="home__instrument">
        <div className="home__instrument-header">
          <h2 id="range-title">Autonomia</h2>
          <span className="home__status">
            <span className="lcm-status-dot" data-status={status} />
            {statusLabel}
          </span>
        </div>

        <div className="home__range">
          {ready ? (
            <p className="home__range-value">
              <AnimatedMetric
                format={(value) => `≈ ${integer.format(value)} km`}
                value={dashboard.rangeKm ?? 0}
              />
            </p>
          ) : (
            <p className="home__range-empty">{rangeLabel}</p>
          )}

          {ready && fuelPercent !== null && (
            <>
              <div className="home__fuel-state">
                <p
                  aria-label={`Combustível estimado: ${integer.format(fuelPercent)}%`}
                  className="home__fuel-percent"
                >
                  <AnimatedMetric
                    format={(value) => `${integer.format(value)}%`}
                    value={fuelPercent}
                  />
                </p>
                <p className={`home__calibration home__calibration--${dashboard.calibrationState}`}>
                  {calibrationLabels[dashboard.calibrationState]}
                </p>
              </div>
              <div
                aria-label={`Combustível estimado: ${integer.format(fuelPercent)}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(fuelPercent)}
                className="lcm-progress-track home__progress"
                role="progressbar"
              >
                <div className="lcm-progress" style={{ width: `${fuelPercent}%` }}>
                  <span className="lcm-progress-glow" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <dl className="home__metrics">
        <div className="home__metric">
          <dt>Consumo</dt>
          <dd>
            {dashboard.consumptionKmPerLiter === null
              ? 'Calibrando'
              : (
                <AnimatedMetric
                  format={(value) => `≈ ${decimal.format(value)} km/L`}
                  value={dashboard.consumptionKmPerLiter}
                />
              )}
          </dd>
        </div>
        <div className="home__metric">
          <dt>Hodômetro</dt>
          <dd>
            <AnimatedMetric
              format={(value) => `${decimal.format(value)} km`}
              value={dashboard.odometerKm}
            />
          </dd>
        </div>
        <div className="home__metric">
          <dt className="home__month">{month.format(now)}</dt>
          <dd>
            <AnimatedMetric
              format={(value) => currency.format(value / 100)}
              value={dashboard.monthSpendCents}
            />
          </dd>
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
          <Icon name="layer" />
          <span>Início</span>
        </button>
        <button onClick={onHistory} type="button">
          <Icon name="time" />
          <span>Histórico</span>
        </button>
      </nav>
    </section>
  )
}
