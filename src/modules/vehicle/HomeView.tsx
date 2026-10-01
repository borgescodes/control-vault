import AnimatedMetric from '../../shared/ui/AnimatedMetric'
import VehicleIcon from '../../shared/ui/VehicleIcon'
import { formatOdometerValue } from './inputFormatters'
import type { VehicleDashboard } from './selectors'
import FuelProgress from './FuelProgress'

type HomeViewProps = {
  dashboard: VehicleDashboard
  notice?: string | null
  onFuel: () => void
  onOdometer: () => void
}

const integer = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
})
const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatRangeDays(value: number | null): string | null {
  if (value === null) return null
  if (value < 1) return '< 1 dia'
  const days = Math.max(1, Math.round(value))
  return `≈ ${days} ${days === 1 ? 'dia' : 'dias'}`
}

function formatMonthDistance(dashboard: VehicleDashboard): string {
  return `${integer.format(dashboard.monthDistanceKm ?? 0)} km`
}

export default function HomeView({
  dashboard,
  notice = null,
  onFuel,
  onOdometer,
}: HomeViewProps) {
  const ready = dashboard.rangeState === 'ready' && dashboard.rangeKm !== null
  const fuelPercent =
    dashboard.fuelPercent === null
      ? null
      : Math.max(0, Math.min(100, dashboard.fuelPercent))
  const hasFuelLevel =
    fuelPercent !== null && dashboard.remainingLiters !== null
  const displayFuelPercent = fuelPercent ?? 0
  const rangeDays = formatRangeDays(dashboard.rangeDays)
  const completedCalibrationCycles = Math.min(
    3,
    dashboard.calibrationCycleCount,
  )

  return (
    <section
      aria-labelledby="home-primary-title"
      className="home"
      data-view-root="true"
      tabIndex={-1}
    >
      <div className="home__instrument">
        <header className="home__hero">
          <div className="home__hero-heading">
            <h2 className="ui-label" id="home-primary-title">
              {ready ? 'Autonomia' : hasFuelLevel ? 'Tanque' : 'Calibração'}
            </h2>
            {ready && rangeDays && (
              <span className="home__days">{rangeDays}</span>
            )}
          </div>

          {ready ? (
            <p className="home__range-value">
              <span className="home__approx">≈</span>{' '}
              <AnimatedMetric
                format={(value) => `${integer.format(value)} km`}
                value={dashboard.rangeKm ?? 0}
              />
            </p>
          ) : hasFuelLevel ? (
            <div className="home__tank-value">
              <p className="home__tank-percent">
                {integer.format(displayFuelPercent)}%
              </p>
              <p className="home__tank-liters">
                {decimal.format(dashboard.remainingLiters ?? 0)} L
              </p>
            </div>
          ) : null}
        </header>

        {hasFuelLevel && (
          <section className="home__fuel" aria-label="Combustível">
            {ready && (
              <div className="home__fuel-readout">
                <span>≈ {decimal.format(dashboard.remainingLiters ?? 0)} L</span>
                <span>{integer.format(displayFuelPercent)}%</span>
              </div>
            )}
            <FuelProgress percent={displayFuelPercent} />
          </section>
        )}

        <section
          aria-label={`Calibração: ${completedCalibrationCycles} de 3 ciclos completos`}
          className="home__calibration"
        >
          <div className="home__calibration-heading">
            <span className="ui-label">Calibração</span>
            <span className="home__calibration-count">
              {completedCalibrationCycles}/3
            </span>
          </div>
          <div aria-hidden="true" className="home__calibration-rail">
            {[0, 1, 2].map((index) => (
              <span
                className={
                  index < completedCalibrationCycles
                    ? 'is-complete'
                    : index === completedCalibrationCycles &&
                        dashboard.calibrationState !== 'calibrated'
                      ? 'is-current'
                      : undefined
                }
                key={index}
              />
            ))}
          </div>
        </section>
      </div>

      {notice && <p className="sr-only" role="status">{notice}</p>}

      <div className="home__actions" aria-label="Ações rápidas">
        <button
          className="button-secondary button-with-icon home__action--secondary"
          onClick={onOdometer}
          type="button"
        >
          <VehicleIcon name="gauge" />
          Atualizar KM
        </button>
        <button
          className="button-primary button-with-icon home__action--primary"
          onClick={onFuel}
          type="button"
        >
          <VehicleIcon name="fuel" />
          Abastecer
        </button>
      </div>

      <section className="home__month" aria-labelledby="month-title">
        <h2 className="ui-label" id="month-title">Este mês</h2>
        <dl className="home__month-grid">
          <div className="home__monthly-primary">
            <dt>Gasto</dt>
            <dd>
              <AnimatedMetric
                format={(value) => currency.format(value / 100)}
                value={dashboard.monthSpendCents}
              />
            </dd>
          </div>
          <div className="home__monthly-primary">
            <dt>Rodado</dt>
            <dd>{formatMonthDistance(dashboard)}</dd>
          </div>
          <div className="home__monthly-secondary">
            <dt>Abastecimentos</dt>
            <dd>{dashboard.monthFuelEntryCount}</dd>
          </div>
          <div className="home__monthly-secondary">
            <dt>Média</dt>
            <dd>
              {currency.format((dashboard.monthAverageRefuelCents ?? 0) / 100)}
            </dd>
          </div>
        </dl>
      </section>

      <dl className="home__secondary">
        {dashboard.consumptionKmPerLiter !== null && (
          <div>
            <dt>Consumo</dt>
            <dd>
              <span className="home__approx">≈</span>{' '}
              {decimal.format(dashboard.consumptionKmPerLiter)} km/L
            </dd>
          </div>
        )}
        <div>
          <dt>Hodômetro</dt>
          <dd>{formatOdometerValue(dashboard.odometerKm)} km</dd>
        </div>
      </dl>
    </section>
  )
}
