import { useState, type FormEvent } from 'react'

import OutlineIcon from '../../shared/ui/OutlineIcon'
import {
  formatOdometerInput,
  formatOdometerValue,
  limitOdometerDigits,
  odometerDigitsFromKm,
  parseOdometerKm,
} from './inputFormatters'
import { recordOdometer } from './vehicleActions'

type OdometerViewProps = {
  currentOdometerKm: number
  onBack: () => void
  onSaved: () => void | Promise<void>
}

type PendingReading = {
  readingKm: number
  recordedAt: string
  deltaKm: number
}

export default function OdometerView({
  currentOdometerKm,
  onBack,
  onSaved,
}: OdometerViewProps) {
  const [odometerDigits, setOdometerDigits] = useState(() =>
    odometerDigitsFromKm(currentOdometerKm),
  )
  const [pending, setPending] = useState<PendingReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const readingKm = parseOdometerKm(odometerDigits)
  const readingValid =
    odometerDigits.length > 0 && readingKm >= currentOdometerKm
  const readingInvalid =
    odometerDigits.length > 0 && readingKm < currentOdometerKm

  async function save(
    nextReadingKm: number,
    recordedAt: string,
    confirmSuspicious = false,
  ) {
    setError(null)
    setSubmitting(true)

    try {
      const result = await recordOdometer(
        nextReadingKm,
        recordedAt,
        confirmSuspicious,
      )

      if (result.kind === 'requires_confirmation') {
        setPending({ readingKm: nextReadingKm, recordedAt, deltaKm: result.deltaKm })
        return
      }

      if (result.kind === 'invalid') {
        setError(result.reason)
        return
      }

      setPending(null)
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!readingValid) return

    void save(readingKm, new Date().toISOString())
  }

  return (
    <section
      aria-labelledby="odometer-title"
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
          <OutlineIcon name="back" />
        </button>
        <div>
          <h2 id="odometer-title">Atualizar KM</h2>
        </div>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Hodômetro
          <input
            aria-describedby="odometer-hint"
            aria-invalid={readingInvalid}
            autoComplete="off"
            inputMode="numeric"
            name="odometer"
            onChange={(event) =>
              setOdometerDigits((current) =>
                limitOdometerDigits(current, event.target.value),
              )
            }
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault()
                setOdometerDigits((value) => value.slice(0, -1))
              }
            }}
            required
            type="text"
            value={formatOdometerInput(odometerDigits)}
          />
          <small
            className={readingInvalid ? 'field-error' : 'field-hint'}
            id="odometer-hint"
          >
            {readingValid
              ? `Atual: ${formatOdometerValue(currentOdometerKm)} km`
              : `Não pode ser menor que ${formatOdometerValue(currentOdometerKm)} km`}
          </small>
        </label>

        {error && <p className="vehicle-alert" role="alert">{error}</p>}

        <button
          aria-busy={submitting}
          className="button-primary button-with-icon vehicle-form__submit"
          disabled={submitting || !readingValid}
          type="submit"
        >
          <OutlineIcon name="gauge" />
          {submitting ? 'Salvando…' : 'Salvar hodômetro'}
        </button>
      </form>

      {pending && (
        <div className="vehicle-confirmation" role="status">
          <p>
            O novo valor adiciona{' '}
            <strong>{formatOdometerValue(pending.deltaKm)} km</strong>.
          </p>
          <div className="vehicle-confirmation__actions">
            <button
              className="button-secondary"
              onClick={() => setPending(null)}
              type="button"
            >
              Corrigir
            </button>
            <button
              className="button-warning"
              disabled={submitting}
              onClick={() =>
                void save(pending.readingKm, pending.recordedAt, true)
              }
              type="button"
            >
              Confirmar mesmo assim
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
