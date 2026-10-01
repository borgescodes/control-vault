import { useState, type FormEvent } from 'react'

import VehicleIcon from '../../shared/ui/VehicleIcon'
import type { SavedTrip } from './domain/types'
import {
  createSavedTrip,
  updateSavedTrip,
  type SavedTripInput,
} from './savedTripActions'

type TripFormViewProps = {
  initialTrip?: SavedTrip | null
  onBack: () => void
  onSaved: (trip: SavedTrip) => void | Promise<void>
}

function distanceInputValue(value: number | null): string {
  if (value === null) return ''

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(value)
}

function parseDistance(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(?:[.,]\d)?$/.test(trimmed)) return null

  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) &&
    parsed > 0 &&
    parsed <= 999_999
    ? parsed
    : null
}

export default function TripFormView({
  initialTrip = null,
  onBack,
  onSaved,
}: TripFormViewProps) {
  const [origin, setOrigin] = useState(initialTrip?.origin ?? '')
  const [destination, setDestination] = useState(
    initialTrip?.destination ?? '',
  )
  const [outboundDistance, setOutboundDistance] = useState(() =>
    distanceInputValue(initialTrip?.outboundDistanceKm ?? null),
  )
  const [hasReturn, setHasReturn] = useState(
    initialTrip !== null && initialTrip.returnDistanceKm !== null,
  )
  const [returnDistance, setReturnDistance] = useState(() =>
    distanceInputValue(initialTrip?.returnDistanceKm ?? null),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const outboundDistanceKm = parseDistance(outboundDistance)
  const returnDistanceKm = hasReturn
    ? parseDistance(returnDistance)
    : null
  const valid =
    origin.trim().length > 0 &&
    origin.trim().length <= 80 &&
    destination.trim().length > 0 &&
    destination.trim().length <= 80 &&
    outboundDistanceKm !== null &&
    (!hasReturn || returnDistanceKm !== null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || outboundDistanceKm === null) return

    const input: SavedTripInput = {
      origin,
      destination,
      outboundDistanceKm,
      returnDistanceKm,
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = initialTrip
        ? await updateSavedTrip(
            initialTrip,
            input,
            new Date().toISOString(),
          )
        : await createSavedTrip(input, new Date().toISOString())

      if (result.kind === 'invalid') {
        setError(result.reason)
        return
      }

      await onSaved(result.trip)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-labelledby="trip-form-title"
      className="vehicle-view"
      data-view-root="true"
      tabIndex={-1}
    >
      <header className="view-header">
        <button
          aria-label="Voltar"
          className="view-back"
          onClick={onBack}
          type="button"
        >
          <VehicleIcon name="back" />
        </button>
        <div>
          <h2 id="trip-form-title">
            {initialTrip ? 'Editar percurso' : 'Novo percurso'}
          </h2>
        </div>
      </header>

      <form className="vehicle-form trip-form" onSubmit={handleSubmit}>
        <label>
          Origem
          <input
            autoComplete="off"
            maxLength={80}
            name="trip-origin"
            onChange={(event) => setOrigin(event.target.value)}
            required
            type="text"
            value={origin}
          />
        </label>

        <label>
          Destino
          <input
            autoComplete="off"
            maxLength={80}
            name="trip-destination"
            onChange={(event) => setDestination(event.target.value)}
            required
            type="text"
            value={destination}
          />
        </label>

        <label>
          Distância da ida
          <div className="trip-distance-input">
            <input
              autoComplete="off"
              inputMode="decimal"
              name="trip-outbound-distance"
              onChange={(event) =>
                setOutboundDistance(event.target.value)
              }
              placeholder="0,0"
              required
              type="text"
              value={outboundDistance}
            />
            <span>km</span>
          </div>
        </label>

        <label className="vehicle-toggle">
          <input
            checked={hasReturn}
            onChange={(event) => setHasReturn(event.target.checked)}
            type="checkbox"
          />
          <span>Cadastrar volta</span>
        </label>

        {hasReturn && (
          <label>
            Distância da volta
            <div className="trip-distance-input">
              <input
                autoComplete="off"
                inputMode="decimal"
                name="trip-return-distance"
                onChange={(event) =>
                  setReturnDistance(event.target.value)
                }
                placeholder="0,0"
                required
                type="text"
                value={returnDistance}
              />
              <span>km</span>
            </div>
          </label>
        )}

        {error && (
          <p className="vehicle-alert" role="alert">
            {error}
          </p>
        )}

        <button
          aria-busy={submitting}
          className="button-primary vehicle-form__submit"
          disabled={submitting || !valid}
          type="submit"
        >
          {submitting ? 'Salvando…' : 'Salvar percurso'}
        </button>
      </form>
    </section>
  )
}
