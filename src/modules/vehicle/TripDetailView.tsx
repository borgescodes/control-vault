import { useState } from 'react'

import VehicleIcon from '../../shared/ui/VehicleIcon'
import {
  estimateTrip,
  type TripLegEstimate,
} from './domain/tripEstimate'
import type { SavedTrip } from './domain/types'
import { deleteSavedTrip } from './savedTripActions'

const distance = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})
const liters = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
})
const consumption = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

type TripDetailViewProps = {
  trip: SavedTrip
  consumptionKmPerLiter: number | null
  fuelPricePerLiter: number | null
  onBack: () => void
  onEdit: () => void
  onDeleted: () => void | Promise<void>
}

function MetricBlock({
  title,
  estimate,
}: {
  title: string
  estimate: TripLegEstimate
}) {
  return (
    <section className="trip-detail__metrics" aria-label={title}>
      <h3>{title}</h3>
      <dl>
        <div>
          <dt>Distãncia</dt>
          <dd>{distance.format(estimate.distanceKm)} km</dd>
        </div>
        <div>
          <dt>Combustível</dt>
          <dd>
            {estimate.liters === null
              ? 'Calibrando'
              : `≈ ${liters.format(estimate.liters)} L`}
          </dd>
        </div>
        <div>
          <dt>Custo</dt>
          <dd>
            {estimate.liters === null
              ? 'Aguardando calibração'
              : estimate.costCents === null
                ? 'Preço indisponível'
                : `≈ ${currency.format(estimate.costCents / 100)}`}
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default function TripDetailView({
  trip,
  consumptionKmPerLiter,
  fuelPricePerLiter,
  onBack,
  onEdit,
  onDeleted,
}: TripDetailViewProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const estimate = estimateTrip({
    outboundDistanceKm: trip.outboundDistanceKm,
    returnDistanceKm: trip.returnDistanceKm,
    consumptionKmPerLiter,
    fuelPricePerLiter,
  })

  async function handleDelete() {
    setDeleting(true)
    setError(null)

    try {
      const deleted = await deleteSavedTrip(
        trip.id,
        new Date().toISOString(),
      )
      if (!deleted) {
        setError('Percurso não encontrado')
        return
      }
      await onDeleted()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Falha ao excluir',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section
      aria-labelledby="trip-detail-title"
      className="vehicle-view trip-detail"
      data-view-root="true"
      tabIndex={-1}
    >
      <header className="view-header trip-detail__header">
        <button
          aria-label="Voltar"
          className="view-back"
          onClick={onBack}
          type="button"
        >
          <VehicleIcon name="back" />
        </button>
        <div className="trip-detail__header-copy">
          <span className="ui-label">Percurso</span>
          <h2 id="trip-detail-title">
            {trip.origin} &gt; {trip.destination}
          </h2>
        </div>
        <button
          className="button-secondary trip-detail__edit"
          onClick={onEdit}
          type="button"
        >
          Editar
        </button>
      </header>

      <MetricBlock estimate={estimate.outbound} title="Ida" />
      {estimate.returnTrip && (
        <MetricBlock estimate={estimate.returnTrip} title="Volta" />
      )}
      {estimate.returnTrip && (
        <MetricBlock estimate={estimate.total} title="Total" />
      )}

      <dl className="trip-detail__references">
        <div>
          <dt>Consumo atual</dt>
          <dd>
            {consumptionKmPerLiter === null
              ? 'Calibrando'
              : `≈ ${consumption.format(consumptionKmPerLiter)} km/L`}
          </dd>
        </div>
        <div>
          <dt>Gasolina</dt>
          <dd>
            {fuelPricePerLiter === null
              ? 'Indisponível'
              : `${currency.format(fuelPricePerLiter)}/L`}
          </dd>
        </div>
      </dl>

      {error && (
        <p className="vehicle-alert" role="alert">
          {error}
        </p>
      )}

      <div className="trip-detail__danger">
        {!confirmDelete ? (
          <button
            className="button-quiet"
            onClick={() => setConfirmDelete(true)}
            type="button"
          >
            Excluir percurso
          </button>
        ) : (
          <div
            className="trip-detail__delete-confirm"
            role="group"
            aria-label="Confirmar exclusão"
          >
            <span>Excluir este percurso?</span>
            <div>
              <button
                className="button-secondary"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="button-danger"
                disabled={deleting}
                onClick={() => void handleDelete()}
                type="button"
              >
                {deleting ? 'Excluindo…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
