export type VehicleState = {
  tankCapacityLiters: number
  initialOdometerKm: number
  initialFullTankAt: string
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
  liters: number
  fullTank: boolean
  fueledAt: string
  createdAt: string
  updatedAt: string
}
