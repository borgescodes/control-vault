import Icon, { type IconName } from '../../shared/ui/Icon'
import type { FuelEntry, OdometerReading } from './domain/types'

type HistoryViewProps = {
  fuelEntries: FuelEntry[]
  odometerReadings: OdometerReading[]
  onBack: () => void
}

export default function HistoryView({
  fuelEntries,
  odometerReadings,
  onBack,
}: HistoryViewProps) {
  const items = [
    ...odometerReadings.map((reading) => ({
      id: `odometer-${reading.id}`,
      at: reading.recordedAt,
      icon: 'time' as IconName,
      label: 'Hodômetro',
      value: `${reading.readingKm} km`,
    })),
    ...fuelEntries.map((entry) => ({
      id: `fuel-${entry.id}`,
      at: entry.fueledAt,
      icon: 'check' as IconName,
      label: 'Abastecimento',
      value: `${
        entry.estimatedLiters === null
          ? ''
          : `≈ ${entry.estimatedLiters} L · `
      }${(entry.amountCents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}`,
    })),
  ].sort((left, right) => right.at.localeCompare(left.at))

  return (
    <section
      aria-labelledby="history-title"
      className="vehicle-panel vehicle-panel--history"
    >
      <header className="vehicle-panel__header">
        <span className="vehicle-panel__icon">
          <Icon name="time" />
        </span>
        <h2 id="history-title">Histórico</h2>
        <span className="vehicle-panel__state">
          <span className="lcm-status-dot" data-status="live" />
          Registro
        </span>
      </header>

      {items.length === 0 ? (
        <p className="history-empty">Nenhum registro</p>
      ) : (
        <ul className="history-rail">
          {items.map((item) => (
            <li className="history-row" key={item.id}>
              <span className="history-row__icon">
                <Icon name={item.icon} />
              </span>
              <span className="history-row__content">
                <strong>{item.label}</strong>
                <span className="history-row__value">{item.value}</span>
              </span>
              <time dateTime={item.at}>
                {new Date(item.at).toLocaleString('pt-BR')}
              </time>
            </li>
          ))}
        </ul>
      )}

      <button
        className="button-secondary vehicle-panel__back"
        onClick={onBack}
        type="button"
      >
        Voltar
      </button>
    </section>
  )
}
