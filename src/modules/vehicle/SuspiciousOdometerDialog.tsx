import { createPortal } from 'react-dom'
import { formatOdometerValue } from './inputFormatters'

type SuspiciousOdometerDialogProps = {
  deltaKm: number
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function SuspiciousOdometerDialog({
  deltaKm,
  submitting,
  onCancel,
  onConfirm,
}: SuspiciousOdometerDialogProps) {
  return createPortal(
    <div className="vehicle-confirmation-backdrop">
      <div
        aria-label="Confirmar salto de hodômetro"
        aria-modal="true"
        className="vehicle-confirmation"
        role="alertdialog"
      >
        <p className="ui-label">Confirmar leitura</p>
        <p className="vehicle-confirmation__value">
          +{formatOdometerValue(deltaKm)} km
        </p>
        <p className="vehicle-confirmation__copy">
          Esse salto é maior que o esperado.
        </p>
        <div className="vehicle-confirmation__actions">
          <button className="button-secondary" onClick={onCancel} type="button">
            Corrigir
          </button>
          <button
            className="button-primary"
            disabled={submitting}
            onClick={onConfirm}
            type="button"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
