import type { SavedTrip } from './domain/types'
import { estimateTrip } from './domain/tripEstimate'

const distance = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

type TripsViewProps = {
  trips: SavedTrip[]
  consumptionKmPerLiter: number | null
  fuelPricePerLiter: number | null
  onNew: () => void
  onOpen: (id: string) => void
}

function costLabel(
  trip: SavedTrip,
  consumptionKmPerLiter: number | null,
  fuelPricePerLiter: number | null,
): string {
  const estimate = estimateTrip({
    outboundDistanceKm: trip.outboundDistanceKm,
    returnDistanceKm: trip.returnDistanceKm,
    consumptionKmPerLiter,
    fuelPricePerLiter,
  })

  if (estimate.total.liters === null) return 'Calibrando'
  if (estimate.total.costCents === null) return 'Preço indisponível'

  return `≈ ${currency.format(estimate.total.costCents / 100)}`
}

export default function TripsView({
  trips,
  consumptionKmPerLiter,
  fuelPricePerLiter,
  onNew,
  onOpen,
}: TripsViewProps) {
  const ordered = [...trips].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )

  return (
    <section
      aria-labelledby="trips-title"
      className="trips"
      data-view-root="true"
      tabIndex={-1}
    >
      <header className="view-header trips__header">
        <h2 id="trips-title">Percursos</h2>
        <button className="button-primary trips__new" onClick={onNew} type="button">
          Novo
        </button>
      </header>

      {ordered.length > 0 && (
        <ul className="trip-list">
          {ordered.map((trip) => {
            const totalDistanceKm =
              trip.outboundDistanceKm + (trip.returnDistanceKm ?? 0)

            return (
              <li key={trip.id}>
                <button
                  aria-label={`${trip.origin} para ${trip.destination}`}
                  className="trip-row"
                  onClick={() => onOpen(trip.id)}
                  type="button"
                >
                  <span className="trip-row__route" title={`${trip.origin} > ${trip.destination}`}>
                    <span>{trip.origin}</span>
                    <span aria-hidden="true" className="trip-row__arrow">&gt;</span>
                    <span>{trip.destination}</span>
                  </span>
                  <span className="trip-row__summary">
                    <span className="trip-row__distance">{distance.format(totalDistanceKm)} km</span>
                    <span className="trip-row__cost">
                      {costLabel(
                        trip,
                        consumptionKmPerLiter,
                        fuelPricePerLiter,
                      )}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
