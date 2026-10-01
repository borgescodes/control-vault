import { useEffect, useState, type FormEvent } from 'react'

import {
  getFuelPriceReference,
  type FuelPriceReference,
} from '../../infrastructure/fuelPrice/fuelPrice'
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
  const [priceReference, setPriceReference] =
    useState<FuelPriceReference | null>(null)

  useEffect(() => {
    let active = true

    const applyRefresh = (reference: FuelPriceReference) => {
      if (active) setPriceReference(reference)
    }

    void getFuelPriceReference(new Date(), applyRefresh)
      .then((reference) => {
        if (active && reference) {
          setPriceReference((current) => current ?? reference)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  const odometerKm = parseOdometerKm(odometerDigits)
  const amountCents = parseMoneyCents(amountDigits)
  const maxAmountCents =
    priceReference === null
      ? null
      : getMaxFuelAmountCents(priceReference.precoMaximo)
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
      priceReference,
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
            aria-describedby={odometerInvalid ? 'fuel-odometer-hint' : undefined}
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
          {odometerInvalid && (
            <small className="field-error" id="fuel-odometer-hint">
              Mínimo {formatOdometerValue(currentOdometerKm)} km
            </small>
          )}
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
          {priceReference !== null && maxAmountCents !== null && (
            <small
              aria-label="Limite estimado para este abastecimento"
              className="field-limit"
              id="fuel-amount-hint"
            >
              <span>Preço de referência: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceReference.precoMedio)}/L</span>
              <span>ANP · Paragominas · {priceReference.semanaInicio} a {priceReference.semanaFim}</span>
              <span>Máximo estimado: ≤ {formatMoneyInput(String(maxAmountCents)).replace(/\u00a0/g, ' ')}</span>
              {amountCents > 0 && <span>Volume estimado: ≈ {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format((amountCents / 100) / priceReference.precoMedio)} L</span>}
            </small>
          )}
          {priceReference === null && <small className="field-hint">Preço de referência indisponível · registro sem estimativa de volume</small>}
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
