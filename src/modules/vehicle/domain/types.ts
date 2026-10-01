export type VehicleState = {
  nominalTankCapacityLiters: number
  initialOdometerKm: number
  initialFullTankAt: string | null
  createdAt: string
  updatedAt: string
}

export type OdometerReading = {
  id: string
  readingKm: number
  recordedAt: string
  source: 'manual' | 'fuel_entry'
  createdAt: string
  updatedAt: string
}

export type FuelEntry = {
  id: string
  odometerKm: number
  amountCents: number
  estimatedLiters: number | null
  referencePricePerLiter: number | null
  referenceWeekStart: string | null
  referenceWeekEnd: string | null
  fullTank: boolean
  fueledAt: string
  createdAt: string
  updatedAt: string
}

export type SavedTrip = {
  id: string
  origin: string
  destination: string
  outboundDistanceKm: number
  returnDistanceKm: number | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}
