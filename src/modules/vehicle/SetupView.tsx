import { useState, type FormEvent } from 'react'

import {
  digitsOnly,
  formatOdometerInput,
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
    <section className="vehicle-view" aria-labelledby="setup-title">
      <header className="view-header">
        <h2 id="setup-title">Configurar veículo</h2>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Hodômetro atual
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

        <label className="vehicle-toggle">
          <input
            checked={fullTank}
            onChange={(event) => setFullTank(event.target.checked)}
            type="checkbox"
          />
          <span>
            Tanque cheio agora
            <small>Marque apenas se o tanque estiver cheio neste momento.</small>
          </span>
        </label>

        {error && <p className="vehicle-alert" role="alert">{error}</p>}

        <button className="button-primary" disabled={submitting} type="submit">
          Começar
        </button>
      </form>
    </section>
  )
}
