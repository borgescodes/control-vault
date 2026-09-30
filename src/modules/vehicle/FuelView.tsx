import { useEffect, useState, type FormEvent } from 'react'

import { getFuelPriceReference } from '../../infrastructure/fuelPrice/fuelPrice'
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
import { getMaxFuelAmountCents } from './domain/config'
import SuspiciousOdometerDialog from './SuspiciousOdometerDialog'
import { recordFuel, type FuelInput } from './vehicleActions'

type FuelViewProps = {
  currentOdometerKm: number
  onBack: () => void
  onSaved: () => void | Promise<void>
}

type PendingFuel = {
  input: FuelInput
  deltaKm: number
}

export default function FuelView({
  currentOdometerKm,
  onBack,
  onSaved,
}: FuelViewProps) {
  const [odometerDigits, setOdometerDigits] = useState(() =>
    odometerDigitsFromKm(currentOdometerKm),
  )
  const [amountDigits, setAmountDigits] = useState('')
  const [fullTank, setFullTank] = useState(false)
  const [pending, setPending] = useState<PendingFuel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [referencePricePerLiter, setReferencePricePerLiter] = useState<
    number | null
  >(null)

  useEffect(() => {
    let active = true

    void getFuelPriceReference(new Date())
      .then((reference) => {
        if (active) setReferencePricePerLiter(reference?.precoMedio ?? null)
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  const odometerKm = parseOdometerKm(odometerDigits)
  const amountCents = parseMoneyCents(amountDigits)
  const maxAmountCents =
    referencePricePerLiter === null
      ? null
      : getMaxFuelAmountCents(referencePricePerLiter)
  const odometerValid =
    odometerDigits.length > 0 && odometerKm >= currentOdometerKm
  const amountValid =
    amountCents > 0 &&
    (maxAmountCents === null || amountCents <= maxAmountCents)
  const odometerInvalid =
    odometerDigits.length > 0 && odometerKm < currentOdometerKm
  const amountInvalid = amountDigits.length > 0 && !amountValid

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
    if (!odometerValid || !amountValid) return

    void save({
      odometerKm,
      amountCents,
      fullTank,
      fueledAt: new Date().toISOString(),
    })
  }

  return (
    <section
      aria-labelledby="fuel-title"
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
          <h2 id="fuel-title">Abastecer</h2>
        </div>
      </header>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Hodômetro
          <input
            aria-describedby="fuel-odometer-hint"
            aria-invalid={odometerInvalid}
            autoComplete="off"
            inputMode="numeric"
            name="odometer"
            onChange={(event) =>
              setOdometerDigits((current) =>
                limitOdometerDigits(current, event.target.value),
              )
            }
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault()
                setOdometerDigits((value) => value.slice(0, -1))
              }
            }}
            required
            type="text"
            value={formatOdometerInput(odometerDigits)}
          />
          <small
            className={odometerInvalid ? 'field-error' : 'field-hint'}
            id="fuel-odometer-hint"
          >
            {odometerValid
              ? `Atual: ${formatOdometerValue(currentOdometerKm)} km`
              : `Mínimo: ${formatOdometerValue(currentOdometerKm)} km`}
          </small>
        </label>

        <label>
          Valor
          <input
            aria-describedby={
              maxAmountCents === null ? undefined : 'fuel-amount-hint'
            }
            aria-invalid={amountInvalid}
            autoComplete="off"
            inputMode="numeric"
            name="amount"
            onChange={(event) =>
              setAmountDigits((current) =>
                limitMoneyDigits(current, event.target.value),
              )
            }
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
          {referencePricePerLiter !== null && maxAmountCents !== null && (
            <small className="field-hint" id="fuel-amount-hint">
              Preço ref.: R${' '}
              {referencePricePerLiter.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              /L · máximo{' '}
              {formatMoneyInput(String(maxAmountCents)).replace(/\u00a0/g, ' ')}
            </small>
          )}
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

        <button
          aria-busy={submitting}
          className="button-primary button-with-icon vehicle-form__submit"
          disabled={submitting || !odometerValid || !amountValid}
          type="submit"
        >
          <VehicleIcon name="fuel" />
          {submitting ? 'Salvando…' : 'Salvar abastecimento'}
        </button>
      </form>

      {pending && (
        <SuspiciousOdometerDialog
          deltaKm={pending.deltaKm}
          onCancel={() => setPending(null)}
          onConfirm={() => void save(pending.input, true)}
          submitting={submitting}
        />
      )}
    </section>
  )
}
