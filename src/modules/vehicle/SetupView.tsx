import { useState, type FormEvent } from 'react'

import { initializeVehicle } from './vehicleActions'

type SetupViewProps = {
  onComplete: () => void | Promise<void>
}

export default function SetupView({ onComplete }: SetupViewProps) {
  const [odometer, setOdometer] = useState('')
  const [fullTank, setFullTank] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await initializeVehicle(
        Number(odometer),
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

      <label>
        <input
          checked={fullTank}
          onChange={(event) => setFullTank(event.target.checked)}
          type="checkbox"
        />
        Tanque cheio agora
      </label>

      {error && <p role="alert">{error}</p>}

      <button disabled={submitting} type="submit">
        Começar
      </button>
    </form>
  )
}
