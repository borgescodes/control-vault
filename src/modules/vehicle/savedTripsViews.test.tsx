import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./savedTripActions', () => ({
  deleteSavedTrip: vi.fn().mockResolvedValue(true),
}))

import type { SavedTrip } from './domain/types'
import TripDetailView from './TripDetailView'
import TripsView from './TripsView'

function trip(overrides: Partial<SavedTrip> = {}): SavedTrip {
  return {
    id: 'trip-1',
    origin: 'Casa',
    destination: 'Juparanã',
    outboundDistanceKm: 14,
    returnDistanceKm: 16,
    deletedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('saved trips views', () => {
  it('offers exactly one creation action in the empty state', () => {
    const markup = renderToStaticMarkup(<TripsView trips={[]} consumptionKmPerLiter={null} fuelPricePerLiter={null} onNew={() => undefined} onOpen={() => undefined} />)
    expect(markup.match(/<button/g)).toHaveLength(1)
    expect(markup).not.toContain('Nenhum percurso salvo')
  })
  it('summarizes a round trip with combined distance and total cost', () => {
    const markup = renderToStaticMarkup(
      <TripsView
        consumptionKmPerLiter={40}
        fuelPricePerLiter={7}
        onNew={() => undefined}
        onOpen={() => undefined}
        trips={[trip()]}
      />,
    )

    expect(markup).toContain('Casa')
    expect(markup).toContain('Juparanã')
    expect(markup).toContain('30 km')
    expect(markup).toContain('R$ 5,25')
    expect(markup).not.toContain('5,25 total')
  })

  it('summarizes an outbound-only trip with its own distance and cost', () => {
    const markup = renderToStaticMarkup(
      <TripsView
        consumptionKmPerLiter={40}
        fuelPricePerLiter={7}
        onNew={() => undefined}
        onOpen={() => undefined}
        trips={[trip({ returnDistanceKm: null })]}
      />,
    )

    expect(markup).toContain('14 km')
    expect(markup).toContain('R$ 2,45')
  })

  it('shows calibration state instead of inventing a cost', () => {
    const markup = renderToStaticMarkup(
      <TripsView
        consumptionKmPerLiter={null}
        fuelPricePerLiter={7}
        onNew={() => undefined}
        onOpen={() => undefined}
        trips={[trip()]}
      />,
    )

    expect(markup).toContain('Calibrando')
    expect(markup).not.toContain('R$')
  })

  it('keeps cost unavailable when the current price is missing', () => {
    const markup = renderToStaticMarkup(<TripsView trips={[trip()]} consumptionKmPerLiter={40} fuelPricePerLiter={null} onNew={() => undefined} onOpen={() => undefined} />)
    expect(markup).toContain('30 km')
    expect(markup).toContain('Preço indisponível')
    expect(markup).not.toContain('R$')
  })

  it('shows outbound, return and total separately in details', () => {
    const markup = renderToStaticMarkup(
      <TripDetailView
        consumptionKmPerLiter={40}
        fuelPricePerLiter={7}
        onBack={() => undefined}
        onDeleted={() => undefined}
        onEdit={() => undefined}
        trip={trip()}
      />,
    )

    expect(markup).toContain('>Ida<')
    expect(markup).toContain('>Volta<')
    expect(markup).toContain('>Total<')
    expect(markup).toContain('14 km')
    expect(markup).toContain('16 km')
    expect(markup).toContain('30 km')
    expect(markup).toContain('R$ 2,45')
    expect(markup).toContain('R$ 2,80')
    expect(markup).toContain('R$ 5,25')
    expect(markup).toContain('≈ 40,0 km/L')
    expect(markup).toContain('R$ 7,00/L')
  })
})
