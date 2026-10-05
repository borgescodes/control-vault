import { useState, type FormEvent } from 'react'

import VehicleIcon from '../../shared/ui/VehicleIcon'
import { updateTankCapacity } from './vehicleActions'

type TankCapacityViewProps = {
  currentCapacityLiters: number
  onBack: () => void
  onSaved: () => void | Promise<void>
}

export default function TankCapacityView({
  currentCapacityLiters,
  onBack,
  onSaved,
}: TankCapacityViewProps) {
  const [value, setValue] = useState(String(currentCapacityLiters))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const capacity = Number(value.replace(',', '.'))

    if (!Number.isFinite(capacity) || capacity <= 0) {
      setError('Informe uma capacidade válida')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await updateTankCapacity(capacity, new Date().toISOString())
      if (result.kind === 'invalid') {
        setError(result.reason)
        return
      }
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-labelledby="tank-capacity-title"
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
          <VehicleIcon name="back" />
        </button>
        <div>
          <h2 id="tank-capacity-title">Capacidade do tanque</h2>
        </div>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Capacidade nominal
          <input
            autoComplete="off"
            inputMode="decimal"
            min="0.1"
            name="tankCapacity"
            onChange={(event) => setValue(event.target.value)}
            required
            step="0.1"
            type="number"
            value={value}
          />
          <small className="field-hint">
            Valor usado nos limites e estimativas de combustível.
          </small>
        </label>

        {error && <p className="vehicle-alert" role="alert">{error}</p>}

        <button
          aria-busy={submitting}
          className="button-primary vehicle-form__submit"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Salvando…' : 'Salvar capacidade'}
        </button>
      </form>
    </section>
  )
}
