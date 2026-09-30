import AnimatedMetric from '../../shared/ui/AnimatedMetric'
import { formatOdometerValue } from './inputFormatters'
import type { VehicleDashboard } from './selectors'

type HomeViewProps = {
  dashboard: VehicleDashboard
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
  if (dashboard.monthDistanceKm === null) return '—'
  const prefix = dashboard.monthDistanceState === 'partial' ? '≥ ' : ''
  return `${prefix}${integer.format(dashboard.monthDistanceKm)} km`
}

export default function HomeView({
  dashboard,
  onFuel,
  onOdometer,
}: HomeViewProps) {
  const ready = dashboard.rangeState === 'ready' && dashboard.rangeKm !== null
  const rangeDays = formatRangeDays(dashboard.rangeDays)
  const rangeNote =
    dashboard.rangeState === 'awaiting_full_tank'
      ? 'Complete um tanque para iniciar a estimativa'
      : dashboard.rangeState === 'calibrating'
        ? 'Calibrando consumo'
        : rangeDays ?? 'Ritmo recente insuficiente'

  const fuelPercent =
    dashboard.fuelPercent === null
      ? null
      : Math.max(0, Math.min(100, dashboard.fuelPercent))

  return (
    <section className="home" aria-labelledby="range-title">
      <header className="home__hero">
        <p className="ui-label" id="range-title">Autonomia</p>
        {ready ? (
          <p className="home__range-value">
            <AnimatedMetric
              format={(value) => `≈ ${integer.format(value)} km`}
              value={dashboard.rangeKm ?? 0}
            />
          </p>
        ) : (
          <p className="home__range-value">—</p>
        )}
        <p className="home__range-note">{rangeNote}</p>
      </header>

      <section className="home__fuel" aria-label="Combustível estimado">
        <div className="home__section-heading">
          <span className="ui-label">Combustível</span>
          <span className="home__fuel-percent">
            {fuelPercent === null ? '—' : `${integer.format(fuelPercent)}%`}
          </span>
        </div>

        <p className="home__fuel-volume">
          {dashboard.remainingLiters === null ? (
            '—'
          ) : (
            <AnimatedMetric
              format={(value) => `≈ ${decimal.format(value)} L`}
              value={dashboard.remainingLiters}
            />
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
            <div className="fuel-progress__value" style={{ width: `${fuelPercent}%` }} />
          </div>
        )}
      </section>

      <section className="home__month" aria-labelledby="month-title">
        <p className="ui-label" id="month-title">Este mês</p>
        <dl className="home__month-grid">
          <div>
            <dt>Gasto</dt>
            <dd>
              <AnimatedMetric
                format={(value) => currency.format(value / 100)}
                value={dashboard.monthSpendCents}
              />
            </dd>
          </div>
          <div>
            <dt>Rodado</dt>
            <dd>{formatMonthDistance(dashboard)}</dd>
            {dashboard.monthDistanceState === 'partial' && (
              <small>desde o cadastro</small>
            )}
          </div>
          <div>
            <dt>Abastecimentos</dt>
            <dd>{dashboard.monthFuelEntryCount}</dd>
          </div>
          <div>
            <dt>Média</dt>
            <dd>
              {dashboard.monthAverageRefuelCents === null
                ? '—'
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
              ? '—'
              : `≈ ${decimal.format(dashboard.consumptionKmPerLiter)} km/L`}
          </dd>
        </div>
        <div>
          <dt>Hodômetro</dt>
          <dd>{formatOdometerValue(dashboard.odometerKm)} km</dd>
        </div>
      </dl>

      <div className="home__actions" aria-label="Ações rápidas">
        <button className="button-secondary" onClick={onOdometer} type="button">
          Atualizar KM
        </button>
        <button className="button-primary" onClick={onFuel} type="button">
          Abastecer
        </button>
      </div>
    </section>
  )
}
