import { useState } from 'react'

import { formatOdometerValue } from './inputFormatters'
import type { FuelEntry, OdometerReading } from './domain/types'
import { uniqueFuelEntries } from './fuelEntries'
import type { ConsumptionCycleAnalytics } from './selectors'

type HistoryViewProps = {
  fuelEntries: FuelEntry[]
  odometerReadings: OdometerReading[]
  consumptionCycles?: ConsumptionCycleAnalytics[]
  onEditFuel?: (id: string) => void
  onDeleteFuel?: (id: string) => void | Promise<void>
}

type HistoryItem = {
  id: string
  at: string
  kind: 'fuel' | 'odometer'
  value: string
  detail: string | null
  fuelId?: string
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const liters = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})
const decimal = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})
const clock = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})
const date = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function dateKey(value: string | Date): string {
  const current = value instanceof Date ? value : new Date(value)
  return [
    current.getFullYear(),
    String(current.getMonth() + 1).padStart(2, '0'),
    String(current.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayLabel(at: string): string {
  const current = new Date(at)
  if (dateKey(current) === dateKey(new Date())) return 'HOJE'

  const day = String(current.getDate()).padStart(2, '0')
  const month = current
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .toUpperCase()
  return `${day} ${month}`
}

export default function HistoryView({
  fuelEntries,
  odometerReadings,
  consumptionCycles = [],
  onEditFuel,
  onDeleteFuel,
}: HistoryViewProps) {
  const [mode, setMode] = useState<'events' | 'cycles'>('events')

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
      fuelId: entry.id,
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

  async function handleDelete(id: string) {
    if (!onDeleteFuel) return
    if (!window.confirm('Excluir este abastecimento?')) return
    await onDeleteFuel(id)
  }

  return (
    <section
      aria-labelledby="history-title"
      className="history"
      data-view-root="true"
      tabIndex={-1}
    >
      <header className="history__header">
        <h2 id="history-title">Histórico</h2>
        <div className="history__mode" aria-label="Modo do histórico">
          <button
            aria-current={mode === 'events' ? 'page' : undefined}
            onClick={() => setMode('events')}
            type="button"
          >
            Eventos
          </button>
          <button
            aria-current={mode === 'cycles' ? 'page' : undefined}
            onClick={() => setMode('cycles')}
            type="button"
          >
            Ciclos
          </button>
        </div>
      </header>

      {mode === 'cycles' ? (
        consumptionCycles.length === 0 ? (
          <p className="history-empty">Nenhum ciclo completo ainda.</p>
        ) : (
          <ol className="history-cycles">
            {[...consumptionCycles].reverse().map((cycle) => (
              <li key={`${cycle.startAt}-${cycle.endAt}`}>
                <time dateTime={cycle.endAt}>{date.format(new Date(cycle.endAt))}</time>
                <strong>{decimal.format(cycle.kmPerLiter)} km/L</strong>
                <span>
                  {decimal.format(cycle.distanceKm)} km ·{' '}
                  {liters.format(cycle.fuelUsedLiters)} L ·{' '}
                  {currency.format(cycle.fuelCostCents / 100)}
                </span>
                <span>
                  {currency.format(cycle.costPerKmCents / 100)}/km
                  {cycle.kmPerLiterChangePercent !== null && (
                    <>
                      {' · '}
                      {cycle.kmPerLiterChangePercent >= 0 ? '+' : ''}
                      {decimal.format(cycle.kmPerLiterChangePercent)}%
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )
      ) : groups.length === 0 ? (
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
                      {item.fuelId && (onEditFuel || onDeleteFuel) && (
                        <span className="history-row__actions">
                          {onEditFuel && (
                            <button
                              onClick={() => onEditFuel(item.fuelId as string)}
                              type="button"
                            >
                              Editar
                            </button>
                          )}
                          {onDeleteFuel && (
                            <button
                              onClick={() => void handleDelete(item.fuelId as string)}
                              type="button"
                            >
                              Excluir
                            </button>
                          )}
                        </span>
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
