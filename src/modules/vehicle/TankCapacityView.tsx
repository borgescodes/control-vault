import { useState, type FormEvent } from 'react'

import VehicleIcon from '../../shared/ui/VehicleIcon'
import { MAX_TANK_CAPACITY_LITERS } from './domain/config'
import { updateTankCapacity } from './vehicleActions'

type TankCapacityViewProps = {
  currentCapacityLiters: number
  onBack: () => void
  onSaved: () => void | Promise<void>
}

function formatCapacity(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(value)
}

function limitCapacityInput(current: string, next: string): string {
  const normalized = next.replace('.', ',')
  if (!/^\d{0,2}(?:,\d{0,2})?$/.test(normalized)) return current
  if (!normalized) return ''
  const parsed = Number(normalized.replace(',', '.'))
  return Number.isFinite(parsed) && parsed <= MAX_TANK_CAPACITY_LITERS
    ? normalized
    : current
}

export default function TankCapacityView({
  currentCapacityLiters,
  onBack,
  onSaved,
}: TankCapacityViewProps) {
  const [value, setValue] = useState(() => formatCapacity(currentCapacityLiters))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const capacity = Number(value.replace(',', '.'))

    if (
      !Number.isFinite(capacity) ||
      capacity <= 0 ||
      capacity > MAX_TANK_CAPACITY_LITERS
    ) {
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
          <h2 id="tank-capacity-title">Capacidade nominal</h2>
        </div>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          <input
            aria-label="Capacidade nominal"
            autoComplete="off"
            inputMode="decimal"
            maxLength={5}
            name="tankCapacity"
            onChange={(event) =>
              setValue((current) =>
                limitCapacityInput(current, event.target.value),
              )
            }
            required
            type="text"
            value={value}
          />
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
