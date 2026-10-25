import { useRef, useState, type FormEvent } from 'react'

import VehicleIcon from '../../shared/ui/VehicleIcon'
import {
  formatMoneyInput,
  formatOdometerInput,
  formatOdometerValue,
  limitMoneyDigits,
  limitOdometerDigits,
  odometerDigitsFromKm,
  parseMoneyCents,
  parseOdometerKm,
} from './inputFormatters'
import { getMaxFuelInputLiters, MAX_FUEL_INPUT_CENTS } from './domain/config'
import type { FuelEntry } from './domain/types'
import SuspiciousOdometerDialog from './SuspiciousOdometerDialog'
import { recordFuel, updateFuelEntry, type FuelEditInput, type FuelInput } from './vehicleActions'

type FuelViewProps = {
  currentOdometerKm: number
  onBack: () => void
  onSaved: () => void | Promise<void>
  tankCapacityLiters: number
  entry?: FuelEntry
}
type PendingFuel = {
  input: FuelInput | FuelEditInput
  deltaKm: number
}
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 16)
}
function parseLiters(value: string): number {
  if (!/^\d{1,2}(?:[,.]\d{1,3})?$/.test(value)) return 0
  return Number(value.replace(',', '.'))
}

export default function FuelView({
  currentOdometerKm, onBack, onSaved, tankCapacityLiters, entry,
}: FuelViewProps) {
  const editing = entry !== undefined
  const [odometerDigits, setOdometerDigits] = useState(() =>
    odometerDigitsFromKm(entry?.odometerKm ?? currentOdometerKm))
  const [amountDigits, setAmountDigits] = useState(() =>
    entry ? String(entry.amountCents) : '')
  const [litersText, setLitersText] = useState(() =>
    entry?.liters ? String(entry.liters).replace('.', ',') : '')
  const [fullTank, setFullTank] = useState(entry?.fullTank ?? false)
  const [fueledAtLocal, setFueledAtLocal] = useState(() =>
    entry ? toDateTimeLocal(entry.fueledAt) : '')
  const [pending, setPending] = useState<PendingFuel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const saving = useRef(false)
  const odometerKm = parseOdometerKm(odometerDigits)
  const amountCents = parseMoneyCents(amountDigits)
  const liters = parseLiters(litersText)
  const maxFuelInputLiters = getMaxFuelInputLiters(tankCapacityLiters)
  const odometerValid = odometerDigits.length > 0 && odometerKm >= 0 &&
    (editing || odometerKm >= currentOdometerKm)
  const amountValid = amountCents > 0 && amountCents <= MAX_FUEL_INPUT_CENTS
  const litersValid = (editing && litersText.trim() === '') ||
    (liters > 0 && liters <= maxFuelInputLiters)
  const canSave = odometerValid && amountValid && litersValid &&
    (editing || liters > 0)

  async function save(input: FuelInput | FuelEditInput, confirmSuspicious = false) {
    if (saving.current) return
    saving.current = true
    setError(null)
    setSubmitting(true)
    try {
      const result = entry
        ? await updateFuelEntry(entry, input as FuelEditInput, new Date().toISOString(), confirmSuspicious)
        : await recordFuel(input as FuelInput, confirmSuspicious)
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
      saving.current = false
      setSubmitting(false)
    }
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return
    if (entry) {
      const at = new Date(fueledAtLocal)
      if (!fueledAtLocal || !Number.isFinite(at.getTime())) {
        setError('Data inválida')
        return
      }
      void save({ odometerKm, amountCents, liters: litersText ? liters : null,
        fullTank, fueledAt: at.toISOString() })
    } else {
      void save({ odometerKm, amountCents, liters, fullTank,
        fueledAt: new Date().toISOString() })
    }
  }

  return (
    <section aria-labelledby="fuel-title" className="vehicle-view" data-view-root="true" tabIndex={-1}>
      <header className="view-header">
        <button aria-label="Voltar" className="view-back" onClick={onBack} type="button">
          <VehicleIcon name="back" />
        </button>
        <div><h2 id="fuel-title">{editing ? 'Corrigir abastecimento' : 'Abastecer'}</h2></div>
      </header>
      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Hodômetro
          <input autoComplete="off" inputMode="numeric" name="odometer"
            aria-invalid={!odometerValid && odometerDigits.length > 0}
            onChange={(event) => setOdometerDigits((value) => limitOdometerDigits(value, event.target.value))}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault()
                setOdometerDigits((value) => value.slice(0, -1))
              }
            }}
            required type="text" value={formatOdometerInput(odometerDigits)} />
          {!odometerValid && !editing && (
            <small className="field-error">Mínimo {formatOdometerValue(currentOdometerKm)} km</small>
          )}
        </label>
        <label>
          Valor
          <input autoComplete="off" inputMode="numeric" name="amount"
            aria-invalid={amountDigits.length > 0 && !amountValid}
            onChange={(event) => setAmountDigits((value) => limitMoneyDigits(value, event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault()
                setAmountDigits((value) => value.slice(0, -1))
              }
            }}
            placeholder="R$ 0,00" required type="text" value={formatMoneyInput(amountDigits)} />
        </label>
        <label>
          Litros
          <input autoComplete="off" inputMode="decimal" name="liters"
            aria-invalid={litersText.length > 0 && !litersValid}
            onChange={(event) => {
              const next = event.target.value.replace('.', ',')
              if (/^\d{0,2}(?:,\d{0,3})?$/.test(next)) setLitersText(next)
            }}
            placeholder="0,000 L" required={!editing} type="text" value={litersText} />
          {editing && entry?.liters == null && entry?.estimatedLiters != null && (
            <small className="field-hint">
              Estimativa antiga: ≈ {entry.estimatedLiters.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L.
              Informe os litros somente se tiver o valor da bomba.
            </small>
          )}
          {litersText && !litersValid && (
            <small className="field-error">Máximo {maxFuelInputLiters.toLocaleString('pt-BR')} L</small>
          )}
          {amountValid && liters > 0 && litersValid && (
            <small className="field-hint">Preço por litro: {currency.format(amountCents / 100 / liters)}/L</small>
          )}
        </label>
        {editing && (
          <label>
            Data e hora
            <input name="fueledAt" onChange={(event) => setFueledAtLocal(event.target.value)}
              required type="datetime-local" value={fueledAtLocal} />
          </label>
        )}
        <label className="vehicle-toggle">
          <input checked={fullTank} onChange={(event) => setFullTank(event.target.checked)}
            type="checkbox" />
          <span>Completei o tanque</span>
        </label>
        {error && <p className="vehicle-alert" role="alert">{error}</p>}
        <button aria-busy={submitting} className="button-primary button-with-icon vehicle-form__submit"
          disabled={submitting || !canSave} type="submit">
          <VehicleIcon name="fuel" />
          {submitting ? 'Salvando…' : editing ? 'Salvar correção' : 'Salvar abastecimento'}
        </button>
      </form>
      {pending && <SuspiciousOdometerDialog deltaKm={pending.deltaKm}
        onCancel={() => setPending(null)} onConfirm={() => void save(pending.input, true)}
        submitting={submitting} />}
    </section>
  )
}
