import { useState, type FormEvent } from 'react'

import Icon from '../../shared/ui/Icon'
import { recordFuel, type FuelInput } from './vehicleActions'

type FuelViewProps = {
  onBack: () => void
  onSaved: () => void | Promise<void>
}

type PendingFuel = {
  input: FuelInput
  deltaKm: number
}

function toCents(value: string): number {
  return Math.round(Number(value.trim().replace(',', '.')) * 100)
}

export default function FuelView({ onBack, onSaved }: FuelViewProps) {
  const [odometer, setOdometer] = useState('')
  const [amount, setAmount] = useState('')
  const [fullTank, setFullTank] = useState(false)
  const [pending, setPending] = useState<PendingFuel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function save(input: FuelInput, confirmSuspicious = false) {
    setError(null)
    setSubmitting(true)

    try {
      const result = await recordFuel(input, confirmSuspicious)

      if (result.kind === 'requires_confirmation') {
        setPending({ input, deltaKm: result.deltaKm })
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
    void save({
      odometerKm: Number(odometer),
      amountCents: toCents(amount),
      fullTank,
      fueledAt: new Date().toISOString(),
    })
  }

  return (
    <section
      aria-labelledby="fuel-title"
      className="vehicle-panel vehicle-panel--fuel"
    >
      <header className="vehicle-panel__header">
        <span className="vehicle-panel__icon">
          <Icon name="check" />
        </span>
        <h2 id="fuel-title">Abastecer</h2>
        <span className="vehicle-panel__state">
          <span className="lcm-status-dot" data-status="estimated" />
          Estimativa
        </span>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label className="vehicle-toggle">
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
          Valor
          <input
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            required
            type="text"
            value={amount}
          />
        </label>

        <label>
          <input
            checked={fullTank}
            onChange={(event) => setFullTank(event.target.checked)}
            type="checkbox"
          />
          Completei o tanque
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
              onClick={() => void save(pending.input, true)}
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
