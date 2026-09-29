import { useState, type FormEvent } from 'react'

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
            onClick={() => void save(pending.input, true)}
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
