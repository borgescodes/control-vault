import { useEffect, useRef, useState, type FormEvent } from 'react'

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
import {
  getMaxFuelAmountCents,
  MAX_FUEL_INPUT_CENTS,
} from './domain/config'
import type { FuelEntry } from './domain/types'
import SuspiciousOdometerDialog from './SuspiciousOdometerDialog'
import {
  recordFuel,
  updateFuelEntry,
  type FuelEditInput,
  type FuelInput,
} from './vehicleActions'

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

function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function FuelView({
  currentOdometerKm,
  onBack,
  onSaved,
  tankCapacityLiters,
  entry,
}: FuelViewProps) {
  const editing = entry !== undefined
  const [odometerDigits, setOdometerDigits] = useState(() =>
    odometerDigitsFromKm(entry?.odometerKm ?? currentOdometerKm),
  )
  const [amountDigits, setAmountDigits] = useState(() =>
    entry ? String(entry.amountCents) : '',
  )
  const [fullTank, setFullTank] = useState(entry?.fullTank ?? false)
  const [fueledAtLocal, setFueledAtLocal] = useState(() =>
    entry ? toDateTimeLocal(entry.fueledAt) : '',
  )
  const [pending, setPending] = useState<PendingFuel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const saving = useRef(false)
  const [priceReference, setPriceReference] =
    useState<FuelPriceReference | null>(null)
  const [referenceExpanded, setReferenceExpanded] = useState(false)

  useEffect(() => {
    if (editing) return

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
  }, [editing])

  const odometerKm = parseOdometerKm(odometerDigits)
  const amountCents = parseMoneyCents(amountDigits)
  const maxAmountCents =
    editing || priceReference === null
      ? null
      : getMaxFuelAmountCents(
          priceReference.precoMaximo,
          tankCapacityLiters,
        )
  const odometerValid =
    odometerDigits.length > 0 &&
    odometerKm >= 0 &&
    (editing || odometerKm >= currentOdometerKm)
  const amountValid =
    amountCents > 0 &&
    amountCents <= MAX_FUEL_INPUT_CENTS &&
    (maxAmountCents === null || amountCents <= maxAmountCents)
  const odometerInvalid =
    odometerDigits.length > 0 && !odometerValid
  const amountInvalid = amountDigits.length > 0 && !amountValid

  async function save(
    input: FuelInput | FuelEditInput,
    confirmSuspicious = false,
  ) {
    if (saving.current) return
    saving.current = true
    setError(null)
    setSubmitting(true)

    try {
      const result = entry
        ? await updateFuelEntry(
            entry,
            input as FuelEditInput,
            new Date().toISOString(),
            confirmSuspicious,
          )
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
    if (!odometerValid || !amountValid) return

    if (entry) {
      const fueledAt = new Date(fueledAtLocal)
      if (!fueledAtLocal || !Number.isFinite(fueledAt.getTime())) {
        setError('Data inválida')
        return
      }
      void save({
        odometerKm,
        amountCents,
        fullTank,
        fueledAt: fueledAt.toISOString(),
      })
      return
    }

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
          <h2 id="fuel-title">
            {editing ? 'Corrigir abastecimento' : 'Abastecer'}
          </h2>
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
          {odometerInvalid && !editing && (
            <small className="field-error" id="fuel-odometer-hint">
              Mínimo {formatOdometerValue(currentOdometerKm)} km
            </small>
          )}
          {odometerInvalid && editing && (
            <small className="field-error" id="fuel-odometer-hint">
              Informe um hodômetro válido.
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
          {!editing && priceReference !== null && maxAmountCents !== null && (
            <div className="fuel-reference">
              <button
                aria-expanded={referenceExpanded}
                className="fuel-reference__toggle"
                onClick={() => setReferenceExpanded((expanded) => !expanded)}
                type="button"
              >
                <span>Referência</span>
                <VehicleIcon
                  name={referenceExpanded ? 'chevron-down' : 'chevron-right'}
                />
              </button>
              {referenceExpanded && (
                <small
                  aria-label="Limite estimado para este abastecimento"
                  className="field-limit fuel-reference__details"
                  id="fuel-amount-hint"
                >
                  <span>
                    Preço de referência:{' '}
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(priceReference.precoMedio)}/L
                  </span>
                  <span>
                    ANP · Paragominas · {priceReference.semanaInicio} a{' '}
                    {priceReference.semanaFim}
                  </span>
                  <span>
                    Máximo estimado: ≤{' '}
                    {formatMoneyInput(String(maxAmountCents)).replace(
                      /\u00a0/g,
                      ' ',
                    )}
                  </span>
                </small>
              )}
            </div>
          )}
          {!editing && priceReference === null && (
            <small className="field-hint">
              Preço de referência indisponível · registro sem estimativa de volume
            </small>
          )}
          {editing && entry.referencePricePerLiter !== null && (
            <small className="field-hint">
              Volume estimado recalculado com o preço salvo de{' '}
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(entry.referencePricePerLiter)}/L.
            </small>
          )}
        </label>

        {editing && (
          <label>
            Data e hora
            <input
              name="fueledAt"
              onChange={(event) => setFueledAtLocal(event.target.value)}
              required
              type="datetime-local"
              value={fueledAtLocal}
            />
          </label>
        )}

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
          {submitting
            ? 'Salvando…'
            : editing
              ? 'Salvar correção'
              : 'Salvar abastecimento'}
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
