import { useState, type FormEvent } from 'react'

import {
  formatOdometerInput,
  limitOdometerDigits,
  parseOdometerKm,
} from './inputFormatters'
import { initializeVehicle } from './vehicleActions'

type SetupViewProps = {
  onComplete: () => void | Promise<void>
}

export default function SetupView({ onComplete }: SetupViewProps) {
  const [odometerDigits, setOdometerDigits] = useState('')
  const [fullTank, setFullTank] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!odometerDigits) return

    setError(null)
    setSubmitting(true)

    try {
      await initializeVehicle(
        parseOdometerKm(odometerDigits),
        fullTank,
        new Date().toISOString(),
      )
      await onComplete()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao começar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-labelledby="setup-title"
      className="vehicle-view"
      data-view-root="true"
      tabIndex={-1}
    >
      <header className="view-header">
        <div>
          <h2 id="setup-title">Configurar veículo</h2>
        </div>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Hodômetro atual
          <input
            autoComplete="off"
            inputMode="numeric"
            name="odometer"
            onChange={(event) =>
              setOdometerDigits((current) =>
                limitOdometerDigits(current, event.target.value),
              )
            }
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

        <label className="vehicle-toggle">
          <input
            checked={fullTank}
            onChange={(event) => setFullTank(event.target.checked)}
            type="checkbox"
          />
          <span>Tanque cheio agora</span>
        </label>

        {error && <p className="vehicle-alert" role="alert">{error}</p>}

        <button
          aria-busy={submitting}
          className="button-primary vehicle-form__submit"
          disabled={submitting || !odometerDigits}
          type="submit"
        >
          {submitting ? 'Salvando…' : 'Começar'}
        </button>
      </form>
    </section>
  )
}
