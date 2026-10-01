import { useState, type FormEvent } from 'react'

import VehicleIcon from '../../shared/ui/VehicleIcon'
import type { SavedTrip } from './domain/types'
import { formatDistanceInput, limitOdometerDigits, odometerDigitsFromKm, parseOdometerKm } from './inputFormatters'
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

function DistanceField({ label, name, digits, onChange }: {
  label: string
  name: string
  digits: string
  onChange: (digits: string) => void
}) {
  return (
    <label>
      {label}
      <div className="trip-distance-input">
        <input
          autoComplete="off"
          inputMode="numeric"
          maxLength={8}
          name={name}
          onChange={(event) => onChange(limitOdometerDigits(digits, event.target.value))}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Backspace') {
              event.preventDefault()
              const input = event.currentTarget
              onChange(input.selectionStart === 0 && input.selectionEnd === input.value.length ? '' : digits.slice(0, -1))
            }
          }}
          placeholder="0,0"
          required
          type="text"
          value={formatDistanceInput(digits)}
        />
        <span>km</span>
      </div>
    </label>
  )
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
    initialTrip ? odometerDigitsFromKm(initialTrip.outboundDistanceKm) : '',
  )
  const [hasReturn, setHasReturn] = useState(
    initialTrip !== null && initialTrip.returnDistanceKm !== null,
  )
  const [returnDistance, setReturnDistance] = useState(() =>
    initialTrip?.returnDistanceKm != null ? odometerDigitsFromKm(initialTrip.returnDistanceKm) : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const outboundDistanceKm = parseOdometerKm(outboundDistance)
  const returnDistanceKm = hasReturn
    ? parseOdometerKm(returnDistance)
    : null
  const valid =
    origin.trim().length > 0 &&
    origin.trim().length <= 80 &&
    destination.trim().length > 0 &&
    destination.trim().length <= 80 &&
    outboundDistanceKm > 0 &&
    (!hasReturn || (returnDistanceKm !== null && returnDistanceKm > 0))

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

        <DistanceField label="Ida" name="trip-outbound-distance" digits={outboundDistance} onChange={setOutboundDistance} />

        <label className="vehicle-toggle">
          <input
            checked={hasReturn}
            onChange={(event) => setHasReturn(event.target.checked)}
            type="checkbox"
          />
          <span>Volta</span>
        </label>

        {hasReturn && (
          <DistanceField label="Volta" name="trip-return-distance" digits={returnDistance} onChange={setReturnDistance} />
        )}

        {error && (
          <p className="vehicle-alert" role="alert">
            {error}
          </p>
        )}

        <button
          aria-busy={submitting}
          className="button-primary button-with-icon vehicle-form__submit"
          disabled={submitting || !valid}
          type="submit"
        >
          <VehicleIcon name="route" />
          {submitting ? 'Salvando…' : 'Salvar percurso'}
        </button>
      </form>
    </section>
  )
}
