import { useState, type FormEvent } from 'react'

import Icon from '../../shared/ui/Icon'
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
  const [odometer, setOdometer] = useState('')
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
    void save(Number(odometer), new Date().toISOString())
  }

  return (
    <section
      aria-labelledby="odometer-title"
      className="vehicle-panel vehicle-panel--odometer"
    >
      <header className="vehicle-panel__header">
        <span className="vehicle-panel__icon">
          <Icon name="refresh" />
        </span>
        <h2 id="odometer-title">Atualizar KM</h2>
        <span className="vehicle-panel__state">
          <span className="lcm-status-dot" data-status="live" />
          Manual
        </span>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Hodômetro
          <input
            min="0"
            onChange={(event) => setOdometer(event.target.value)}
            required
            step="0.1"
            type="number"
            value={odometer}
          />
        </label>

        {error && <p className="vehicle-alert" role="alert">{error}</p>}

        <button className="button-primary" disabled={submitting} type="submit">
          Salvar
        </button>
      </form>

      {pending && (
        <div className="vehicle-confirmation">
          <p>Confirmar salto de {pending.deltaKm} km?</p>
          <div className="vehicle-confirmation__actions">
            <button
              className="button-primary"
              disabled={submitting}
              onClick={() =>
                void save(pending.readingKm, pending.recordedAt, true)
              }
              type="button"
            >
              Confirmar
            </button>
            <button
              className="button-secondary"
              onClick={() => setPending(null)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
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
