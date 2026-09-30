import { useState, type FormEvent } from 'react'

import {
  digitsOnly,
  formatOdometerInput,
  formatOdometerValue,
  parseOdometerKm,
} from './inputFormatters'
import { recordOdometer } from './vehicleActions'

type OdometerViewProps = {
  onBack: () => void
  onSaved: () => void | Promise<void>
}

type PendingReading = {
  readingKm: number
  recordedAt: string
  deltaKm: number
}

export default function OdometerView({
  onBack,
  onSaved,
}: OdometerViewProps) {
  const [odometerDigits, setOdometerDigits] = useState('')
  const [pending, setPending] = useState<PendingReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function save(
    readingKm: number,
    recordedAt: string,
    confirmSuspicious = false,
  ) {
    setError(null)
    setSubmitting(true)

    try {
      const result = await recordOdometer(
        readingKm,
        recordedAt,
        confirmSuspicious,
      )

      if (result.kind === 'requires_confirmation') {
        setPending({ readingKm, recordedAt, deltaKm: result.deltaKm })
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
    void save(parseOdometerKm(odometerDigits), new Date().toISOString())
  }

  return (
    <section className="vehicle-view" aria-labelledby="odometer-title">
      <header className="view-header">
        <button aria-label="Voltar" className="view-back" onClick={onBack} type="button">
          ←
        </button>
        <h2 id="odometer-title">Atualizar KM</h2>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Hodômetro
          <input
            autoComplete="off"
            inputMode="numeric"
            name="odometer"
            onChange={(event) => setOdometerDigits(digitsOnly(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault()
                setOdometerDigits((value) => value.slice(0, -1))
              }
            }}
            placeholder="0.0"
            required
            type="text"
            value={formatOdometerInput(odometerDigits)}
          />
        </label>

        {error && <p className="vehicle-alert" role="alert">{error}</p>}

        <button className="button-primary" disabled={submitting} type="submit">
          Salvar hodômetro
        </button>
      </form>

      {pending && (
        <div className="vehicle-confirmation" role="status">
          <p>
            O novo valor adiciona <strong>{formatOdometerValue(pending.deltaKm)} km</strong>.
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
