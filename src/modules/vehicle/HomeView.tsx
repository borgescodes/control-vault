import AnimatedMetric from '../../shared/ui/AnimatedMetric'
import VehicleIcon from '../../shared/ui/VehicleIcon'
import { formatOdometerValue } from './inputFormatters'
import type { VehicleDashboard } from './selectors'

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
  if (dashboard.monthDistanceKm === null) return 'Sem base'
  const prefix = dashboard.monthDistanceState === 'partial' ? '≥ ' : ''
  return `${prefix}${integer.format(dashboard.monthDistanceKm)} km`
}

export default function HomeView({
  dashboard,
  notice = null,
  onFuel,
  onOdometer,
}: HomeViewProps) {
  const ready = dashboard.rangeState === 'ready' && dashboard.rangeKm !== null
  const rangeDays = formatRangeDays(dashboard.rangeDays)
  const rangeState =
    dashboard.rangeState === 'awaiting_full_tank'
      ? 'Sem estimativa'
      : dashboard.rangeState === 'calibrating'
        ? 'Calibrando'
        : null
  const rangeNote =
    dashboard.rangeState === 'awaiting_full_tank'
      ? 'Complete um tanque para iniciar a estimativa'
      : dashboard.rangeState === 'calibrating'
        ? null
        : rangeDays ?? 'Ritmo recente insuficiente'

  const fuelPercent =
    dashboard.fuelPercent === null
      ? null
      : Math.max(0, Math.min(100, dashboard.fuelPercent))

  return (
    <section
      aria-labelledby="range-title"
      className="home"
      data-view-root="true"
      tabIndex={-1}
    >
      <div className="home__instrument">
        <header className="home__hero">
          <h2 className="ui-label" id="range-title">Autonomia</h2>
          {ready ? (
            <p className="home__range-value">
              <span className="home__approx">≈</span>{' '}
              <AnimatedMetric
                format={(value) => `${integer.format(value)} km`}
                value={dashboard.rangeKm ?? 0}
              />
            </p>
          ) : (
            <p className="home__range-state">{rangeState}</p>
          )}
          {rangeNote && <p className="home__range-note">{rangeNote}</p>}
        </header>

        <section className="home__fuel" aria-label="Combustível estimado">
          <div className="home__section-heading">
            <span className="ui-label">Combustível</span>
            <span className="home__fuel-percent">
              {fuelPercent === null
                ? 'Sem leitura'
                : `${integer.format(fuelPercent)}%`}
            </span>
          </div>

          <p className="home__fuel-volume">
            {dashboard.remainingLiters === null ? (
              <span className="home__muted-value">Estimativa indisponível</span>
            ) : (
              <>
                <span className="home__approx">≈</span>{' '}
                <AnimatedMetric
                  format={(value) => `${decimal.format(value)} L`}
                  value={dashboard.remainingLiters}
                />
              </>
            )}
          </p>

          {fuelPercent !== null && (
            <div
              aria-label={`Combustível estimado: ${integer.format(fuelPercent)}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(fuelPercent)}
              className="fuel-progress"
              role="progressbar"
            >
              <div
                className="fuel-progress__value"
                style={{ width: `${fuelPercent}%` }}
              />
              <span aria-hidden="true" className="fuel-progress__tick fuel-progress__tick--one" />
              <span aria-hidden="true" className="fuel-progress__tick fuel-progress__tick--two" />
              <span aria-hidden="true" className="fuel-progress__tick fuel-progress__tick--three" />
            </div>
          )}
        </section>
      </div>

      {notice && <p className="home__notice" role="status">{notice}</p>}

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
              {dashboard.monthAverageRefuelCents === null
                ? 'Sem dados'
                : currency.format(dashboard.monthAverageRefuelCents / 100)}
            </dd>
          </div>
        </dl>
      </section>

      <dl className="home__secondary">
        <div>
          <dt>Consumo</dt>
          <dd>
            {dashboard.consumptionKmPerLiter === null
              ? 'Calibrando'
              : (
                  <>
                    <span className="home__approx">≈</span>{' '}
                    {decimal.format(dashboard.consumptionKmPerLiter)} km/L
                  </>
                )}
          </dd>
        </div>
        <div>
          <dt>Hodômetro</dt>
          <dd>{formatOdometerValue(dashboard.odometerKm)} km</dd>
        </div>
      </dl>
    </section>
  )
}
