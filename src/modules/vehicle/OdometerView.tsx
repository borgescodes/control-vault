import { useRef, useState, type FormEvent } from 'react'

import VehicleIcon from '../../shared/ui/VehicleIcon'
import {
  formatOdometerInput, formatOdometerValue, limitOdometerDigits,
  odometerDigitsFromKm, parseOdometerKm,
} from './inputFormatters'
import type { OdometerReading } from './domain/types'
import SuspiciousOdometerDialog from './SuspiciousOdometerDialog'
import { recordOdometer, updateOdometerReading } from './vehicleActions'

type OdometerViewProps = {
  currentOdometerKm: number
  onBack: () => void
  onSaved: () => void | Promise<void>
  entry?: OdometerReading
}
type PendingReading = {
  readingKm: number
  recordedAt: string
  tankEmpty: boolean
  deltaKm: number
}
function localTime(value: string): string {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 16)
}

export default function OdometerView({
  currentOdometerKm, onBack, onSaved, entry,
}: OdometerViewProps) {
  const editing = entry !== undefined
  const [odometerDigits, setOdometerDigits] = useState(() =>
    odometerDigitsFromKm(entry?.readingKm ?? currentOdometerKm))
  const [recordedAtLocal, setRecordedAtLocal] = useState(() =>
    entry ? localTime(entry.recordedAt) : '')
  const [tankEmpty, setTankEmpty] = useState(entry?.tankEmpty ?? false)
  const [pending, setPending] = useState<PendingReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const saving = useRef(false)
  const readingKm = parseOdometerKm(odometerDigits)
  const readingValid = odometerDigits.length > 0 && (
    editing ? readingKm >= 0 : readingKm > currentOdometerKm)
  const readingInvalid = odometerDigits.length > 0 && !readingValid

  async function save(
    nextReadingKm: number, recordedAt: string, wasEmpty: boolean,
    confirmSuspicious = false,
  ) {
    if (saving.current) return
    saving.current = true
    setError(null)
    setSubmitting(true)
    try {
      const result = entry
        ? await updateOdometerReading(
            entry, { readingKm: nextReadingKm, recordedAt, tankEmpty: wasEmpty },
            new Date().toISOString(), confirmSuspicious,
          )
        : await recordOdometer(nextReadingKm, recordedAt, confirmSuspicious, wasEmpty)
      if (result.kind === 'requires_confirmation') {
        setPending({ readingKm: nextReadingKm, recordedAt, tankEmpty: wasEmpty,
          deltaKm: result.deltaKm })
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
    if (!readingValid) return
    if (entry) {
      const at = new Date(recordedAtLocal)
      if (!recordedAtLocal || !Number.isFinite(at.getTime())) {
        setError('Data inválida')
        return
      }
      void save(readingKm, at.toISOString(), tankEmpty)
    } else {
      void save(readingKm, new Date().toISOString(), tankEmpty)
    }
  }

  return (
    <section aria-labelledby="odometer-title" className="vehicle-view" data-view-root="true" tabIndex={-1}>
      <header className="view-header">
        <button aria-label="Voltar" className="view-back" onClick={onBack} type="button">
          <VehicleIcon name="back" />
        </button>
        <div><h2 id="odometer-title">{editing ? 'Corrigir hodômetro' : 'Atualizar KM'}</h2></div>
      </header>
      <form className="vehicle-form" onSubmit={handleSubmit}>
        <label>
          Hodômetro
          <input aria-describedby="odometer-hint" aria-invalid={readingInvalid}
            autoComplete="off" inputMode="numeric" name="odometer"
            onChange={(event) => setOdometerDigits((value) =>
              limitOdometerDigits(value, event.target.value))}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault()
                setOdometerDigits((value) => value.slice(0, -1))
              }
            }}
            required type="text" value={formatOdometerInput(odometerDigits)} />
          <small className={readingInvalid ? 'field-error' : 'field-hint'} id="odometer-hint">
            {editing
              ? 'A correção deve respeitar a sequência do histórico.'
              : `Deve ser maior que ${formatOdometerValue(currentOdometerKm)} km`}
          </small>
        </label>
        {editing && (
          <label>
            Data e hora
            <input name="recordedAt" onChange={(event) => setRecordedAtLocal(event.target.value)}
              required type="datetime-local" value={recordedAtLocal} />
          </label>
        )}
        <label className="vehicle-toggle">
          <input name="tankEmpty" type="checkbox" checked={tankEmpty}
            onChange={(event) => setTankEmpty(event.target.checked)} />
          <span>Tanque estava vazio</span>
        </label>
        {error && <p className="vehicle-alert" role="alert">{error}</p>}
        <button aria-busy={submitting} className="button-primary button-with-icon vehicle-form__submit"
          disabled={submitting || !readingValid} type="submit">
          <VehicleIcon name="gauge" />
          {submitting ? 'Salvando…' : editing ? 'Salvar correção' : 'Salvar hodômetro'}
        </button>
      </form>
      {pending && (
        <SuspiciousOdometerDialog deltaKm={pending.deltaKm}
          onCancel={() => setPending(null)}
          onConfirm={() => void save(pending.readingKm, pending.recordedAt, pending.tankEmpty, true)}
          submitting={submitting} />
      )}
    </section>
  )
}
