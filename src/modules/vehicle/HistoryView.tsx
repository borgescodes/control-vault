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
      label: 'Hodômetro',
      value: `${reading.readingKm} km`,
    })),
    ...fuelEntries.map((entry) => ({
      id: `fuel-${entry.id}`,
      at: entry.fueledAt,
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
    <section>
      <h2>Histórico</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.label}</strong> {item.value}{' '}
            <time dateTime={item.at}>
              {new Date(item.at).toLocaleString('pt-BR')}
            </time>
          </li>
        ))}
      </ul>
      <button onClick={onBack} type="button">
        Voltar
      </button>
    </section>
  )
}
