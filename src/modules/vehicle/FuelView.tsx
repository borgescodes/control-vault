import { useState, type FormEvent } from 'react'

import {
  digitsOnly,
  formatMoneyInput,
  formatOdometerInput,
  formatOdometerValue,
  parseMoneyCents,
  parseOdometerKm,
} from './inputFormatters'
import { recordFuel, type FuelInput } from './vehicleActions'

type FuelViewProps = {
  onBack: () => void
  onSaved: () => void | Promise<void>
}

type PendingFuel = {
  input: FuelInput
  deltaKm: number
}

export default function FuelView({ onBack, onSaved }: FuelViewProps) {
  const [odometerDigits, setOdometerDigits] = useState('')
  const [amountDigits, setAmountDigits] = useState('')
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
      odometerKm: parseOdometerKm(odometerDigits),
      amountCents: parseMoneyCents(amountDigits),
      fullTank,
      fueledAt: new Date().toISOString(),
    })
  }

  return (
    <section className="vehicle-view" aria-labelledby="fuel-title">
      <header className="view-header">
        <button aria-label="Voltar" className="view-back" onClick={onBack} type="button">
          ←
        </button>
        <h2 id="fuel-title">Abastecer</h2>
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

        <label>
          Valor
          <input
            autoComplete="off"
            inputMode="numeric"
            name="amount"
            onChange={(event) => setAmountDigits(digitsOnly(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault()
                setAmountDigits((value) => value.slice(0, -1))
              }
            }}
            placeholder="R$ 0,00"
            required
            type="text"
            value={formatMoneyInput(amountDigits)}
          />
        </label>

        <label className="vehicle-toggle">
          <input
            checked={fullTank}
            onChange={(event) => setFullTank(event.target.checked)}
            type="checkbox"
          />
          <span>Completei o tanque</span>
        </label>

        {error && <p className="vehicle-alert" role="alert">{error}</p>}

        <button className="button-primary" disabled={submitting} type="submit">
          Salvar abastecimento
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
              onClick={() => void save(pending.input, true)}
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
