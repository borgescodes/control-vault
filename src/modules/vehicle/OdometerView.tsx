import { useState, type FormEvent } from 'react'

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
    <section>
      <form onSubmit={handleSubmit}>
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

        {error && <p role="alert">{error}</p>}

        <button disabled={submitting} type="submit">
          Salvar
        </button>
      </form>

      {pending && (
        <div>
          <p>Confirmar salto de {pending.deltaKm} km?</p>
          <button
            disabled={submitting}
            onClick={() =>
              void save(pending.readingKm, pending.recordedAt, true)
            }
            type="button"
          >
            Confirmar
          </button>
          <button onClick={() => setPending(null)} type="button">
            Cancelar
          </button>
        </div>
      )}

      <button onClick={onBack} type="button">
        Voltar
      </button>
    </section>
  )
}
