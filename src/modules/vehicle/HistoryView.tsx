import { formatOdometerValue } from './inputFormatters'
import type { FuelEntry, OdometerReading } from './domain/types'
import { uniqueFuelEntries } from './fuelEntries'

type HistoryViewProps = {
  fuelEntries: FuelEntry[]
  odometerReadings: OdometerReading[]
}

type HistoryItem = {
  id: string
  at: string
  kind: 'fuel' | 'odometer'
  value: string
  detail: string | null
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const liters = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})
const clock = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

function dateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayLabel(at: string): string {
  const date = new Date(at)
  if (dateKey(date) === dateKey(new Date())) return 'HOJE'

  const day = String(date.getDate()).padStart(2, '0')
  const month = date
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .toUpperCase()
  return `${day} ${month}`
}

export default function HistoryView({
  fuelEntries,
  odometerReadings,
}: HistoryViewProps) {
  const items: HistoryItem[] = [
    ...odometerReadings
      .filter((reading) => reading.source === 'manual')
      .map((reading) => ({
        id: `odometer-${reading.id}`,
        at: reading.recordedAt,
        kind: 'odometer' as const,
        value: `${formatOdometerValue(reading.readingKm)} km`,
        detail: null,
      })),
    ...uniqueFuelEntries(fuelEntries).map((entry) => ({
      id: `fuel-${entry.id}`,
      at: entry.fueledAt,
      kind: 'fuel' as const,
      value: currency.format(entry.amountCents / 100),
      detail: [
        `${formatOdometerValue(entry.odometerKm)} km`,
        entry.estimatedLiters === null
          ? null
          : `≈ ${liters.format(entry.estimatedLiters)} L`,
        entry.fullTank ? 'tanque cheio' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  ].sort((left, right) => right.at.localeCompare(left.at))

  const groups = items.reduce<
    Array<{ key: string; label: string; items: HistoryItem[] }>
  >((result, item) => {
    const key = dateKey(item.at)
    const current = result[result.length - 1]
    if (current?.key === key) {
      current.items.push(item)
    } else {
      result.push({ key, label: dayLabel(item.at), items: [item] })
    }
    return result
  }, [])

  return (
    <section
      aria-labelledby="history-title"
      className="history"
      data-view-root="true"
      tabIndex={-1}
    >
      <header className="history__header">
        <h2 id="history-title">Histórico</h2>
      </header>

      {groups.length === 0 ? (
        <p className="history-empty">Nenhum registro ainda.</p>
      ) : (
        <div className="history-groups">
          {groups.map((group) => (
            <section className="history-day" key={group.key}>
              <h3>{group.label}</h3>
              <ul>
                {group.items.map((item) => (
                  <li
                    className={`history-row history-row--${item.kind}`}
                    key={item.id}
                  >
                    <span aria-hidden="true" className="history-row__marker" />
                    <span className="history-row__content">
                      <strong className="history-row__value">{item.value}</strong>
                      {item.detail && (
                        <span className="history-row__detail">{item.detail}</span>
                      )}
                    </span>
                    <time dateTime={item.at}>{clock.format(new Date(item.at))}</time>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
