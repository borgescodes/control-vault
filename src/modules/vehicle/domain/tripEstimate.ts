export type TripLegEstimate = {
  distanceKm: number
  liters: number | null
  costCents: number | null
}

export type TripEstimate = {
  outbound: TripLegEstimate
  returnTrip: TripLegEstimate | null
  total: TripLegEstimate
}

type TripEstimateInput = {
  outboundDistanceKm: number
  returnDistanceKm: number | null
  consumptionKmPerLiter: number | null
  fuelPricePerLiter: number | null
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function estimateLeg(
  distanceKm: number,
  consumptionKmPerLiter: number | null,
  fuelPricePerLiter: number | null,
): TripLegEstimate {
  if (!positiveFinite(distanceKm)) {
    throw new RangeError('Distance must be greater than zero')
  }

  if (consumptionKmPerLiter === null) {
    return { distanceKm, liters: null, costCents: null }
  }

  if (!positiveFinite(consumptionKmPerLiter)) {
    throw new RangeError('Consumption must be greater than zero')
  }

  const liters = distanceKm / consumptionKmPerLiter

  if (fuelPricePerLiter === null) {
    return { distanceKm, liters, costCents: null }
  }

  if (!positiveFinite(fuelPricePerLiter)) {
    throw new RangeError('Fuel price must be greater than zero')
  }

  return {
    distanceKm,
    liters,
    costCents: Math.round(liters * fuelPricePerLiter * 100),
  }
}

export function estimateTrip({
  outboundDistanceKm,
  returnDistanceKm,
  consumptionKmPerLiter,
  fuelPricePerLiter,
}: TripEstimateInput): TripEstimate {
  if (returnDistanceKm !== null && !positiveFinite(returnDistanceKm)) {
    throw new RangeError('Return distance must be greater than zero')
  }

  const outbound = estimateLeg(
    outboundDistanceKm,
    consumptionKmPerLiter,
    fuelPricePerLiter,
  )
  const returnTrip =
    returnDistanceKm === null
      ? null
      : estimateLeg(
          returnDistanceKm,
          consumptionKmPerLiter,
          fuelPricePerLiter,
        )

  if (!returnTrip) {
    return { outbound, returnTrip: null, total: outbound }
  }

  return {
    outbound,
    returnTrip,
    total: {
      distanceKm: outbound.distanceKm + returnTrip.distanceKm,
      liters:
        outbound.liters === null || returnTrip.liters === null
          ? null
          : outbound.liters + returnTrip.liters,
      costCents:
        outbound.costCents === null || returnTrip.costCents === null
          ? null
          : outbound.costCents + returnTrip.costCents,
    },
  }
}
