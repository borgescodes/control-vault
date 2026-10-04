import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const syncStub = vi.hoisted(() => ({
  syncCurrentSessionIfOnline: vi.fn().mockResolvedValue(undefined),
}))
const priceStub = vi.hoisted(() => ({
  getFuelPriceReference: vi.fn(),
}))

vi.mock('../../infrastructure/sync/sync', () => syncStub)
vi.mock('../../infrastructure/fuelPrice/fuelPrice', () => priceStub)

import {
  getVehicleState,
  listFuelEntries,
  listOdometerReadings,
} from '../../infrastructure/local/store'
import { resetLocalDatabase } from '../../infrastructure/local/db'
import {
  initializeVehicle,
  recordFuel,
  recordOdometer,
  updateTankCapacity,
} from './vehicleActions'

const initialAt = '2026-09-29T10:00:00.000Z'
const laterAt = '2026-09-30T10:00:00.000Z'
const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
const priceReference = {
  uf: 'PA',
  municipio: 'PARAGOMINAS',
  produto: 'GASOLINA COMUM',
  semanaInicio: '2026-09-27',
  semanaFim: '2026-10-03',
  precoMedio: 7.05,
  precoMinimo: 6.79,
  precoMaximo: 7.22,
  postosPesquisados: 37,
}

function nextUuid(sequence: number): ReturnType<Crypto['randomUUID']> {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`
}

describe('vehicle actions', () => {
  it('rejects a repeated full tank at the same mileage with a later timestamp', async () => {
    await initializeVehicle(1_000, true, initialAt)
    const input = { odometerKm: 1_100, amountCents: 2_005, fullTank: true, fueledAt: laterAt }
    expect(await recordFuel(input)).toEqual({ kind: 'saved' })
    expect(await recordFuel({ ...input, fueledAt: '2026-10-01T10:00:00.000Z' })).toEqual({
      kind: 'invalid', reason: 'Abastecimento já registrado',
    })
    expect(await listFuelEntries()).toHaveLength(1)
    expect(await listOdometerReadings()).toHaveLength(1)
  })

  it('prevents concurrent repeated full tanks atomically', async () => {
    await initializeVehicle(1_000, true, initialAt)
    const input = { odometerKm: 1_100, amountCents: 2_005, fullTank: true, fueledAt: laterAt }
    const results = await Promise.all([recordFuel(input), recordFuel(input)])
    expect(results.filter(({ kind }) => kind === 'saved')).toHaveLength(1)
    expect(results.filter(({ kind }) => kind === 'invalid')).toHaveLength(1)
    expect(await listFuelEntries()).toHaveLength(1)
    expect(await listOdometerReadings()).toHaveLength(1)
  })

  it('preserves separate partial refuels at the same mileage', async () => {
    await initializeVehicle(1_000, true, initialAt)
    const input = { odometerKm: 1_100, amountCents: 1_000, fullTank: false, fueledAt: laterAt }
    expect(await recordFuel(input)).toEqual({ kind: 'saved' })
    expect(await recordFuel({ ...input, fueledAt: '2026-10-01T10:00:00.000Z' })).toEqual({ kind: 'saved' })
    expect(await listFuelEntries()).toHaveLength(2)
  })

  let sequence = 0

  beforeEach(async () => {
    await resetLocalDatabase()
    syncStub.syncCurrentSessionIfOnline.mockClear()
    priceStub.getFuelPriceReference.mockReset()
    priceStub.getFuelPriceReference.mockResolvedValue(priceReference)
    sequence = 0
    randomUUID.mockImplementation(() => nextUuid(++sequence))
  })

  afterAll(async () => {
    randomUUID.mockRestore()
    await resetLocalDatabase()
  })

  it('initializes without a full-tank anchor when setup starts not full', async () => {
    await initializeVehicle(1_000, false, initialAt)

    await expect(getVehicleState()).resolves.toMatchObject({
      nominalTankCapacityLiters: 3.5,
      initialOdometerKm: 1_000,
      initialFullTankAt: null,
      createdAt: initialAt,
      updatedAt: initialAt,
    })
    expect(syncStub.syncCurrentSessionIfOnline).toHaveBeenCalledOnce()
  })

  it('initializes with a full-tank anchor when setup starts full', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(getVehicleState()).resolves.toMatchObject({
      nominalTankCapacityLiters: 3.5,
      initialFullTankAt: initialAt,
    })
  })

  it('updates tank capacity without resetting the vehicle epoch', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(updateTankCapacity(3.5, laterAt)).resolves.toEqual({
      kind: 'saved',
    })

    await expect(getVehicleState()).resolves.toMatchObject({
      nominalTankCapacityLiters: 3.5,
      initialOdometerKm: 1_000,
      initialFullTankAt: initialAt,
      createdAt: initialAt,
      updatedAt: laterAt,
      syncStatus: 'pending',
    })
    expect(syncStub.syncCurrentSessionIfOnline).toHaveBeenCalledTimes(2)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid tank capacity %s',
    async (capacity) => {
      await initializeVehicle(1_000, true, initialAt)

      await expect(updateTankCapacity(capacity, laterAt)).resolves.toMatchObject({
        kind: 'invalid',
      })
      await expect(getVehicleState()).resolves.toMatchObject({
        nominalTankCapacityLiters: 3.5,
        updatedAt: initialAt,
      })
    },
  )

  it('creates the initial manual odometer reading', async () => {
    await initializeVehicle(1_000, false, initialAt)

    await expect(listOdometerReadings()).resolves.toEqual([
      expect.objectContaining({
        readingKm: 1_000,
        recordedAt: initialAt,
        source: 'manual',
        syncStatus: 'pending',
      }),
    ])
  })

  it('rolls back vehicle state when the initial reading cannot be written', async () => {
    randomUUID.mockReturnValueOnce(
      undefined as unknown as ReturnType<Crypto['randomUUID']>,
    )

    await expect(
      initializeVehicle(1_000, false, initialAt),
    ).rejects.toBeDefined()
    await expect(getVehicleState()).resolves.toBeNull()
    await expect(listOdometerReadings()).resolves.toEqual([])
  })

  it('rejects a negative initial odometer', async () => {
    await expect(
      initializeVehicle(-1, false, initialAt),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(getVehicleState()).resolves.toBeNull()
  })

  it('saves a normal odometer reading', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(recordOdometer(1_100, laterAt)).resolves.toEqual({
      kind: 'saved',
    })
    await expect(listOdometerReadings()).resolves.toHaveLength(2)
    expect(syncStub.syncCurrentSessionIfOnline).toHaveBeenCalledTimes(2)
  })

  it('rejects a concurrent odometer write that becomes regressive', async () => {
    await initializeVehicle(1_000, true, initialAt)

    const [higher, lower] = await Promise.all([
      recordOdometer(1_100, '2026-09-30T10:00:00.000Z'),
      recordOdometer(1_050, '2026-09-30T10:01:00.000Z'),
    ])

    expect(higher).toEqual({ kind: 'saved' })
    expect(lower).toMatchObject({ kind: 'invalid' })
    expect(
      (await listOdometerReadings()).map(({ readingKm }) => readingKm).sort(),
    ).toEqual([1_000])
  })

  it('does not write an odometer regression', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(recordOdometer(999.9, laterAt)).resolves.toMatchObject({
      kind: 'invalid',
    })
    await expect(listOdometerReadings()).resolves.toHaveLength(1)
  })

  it('requires confirmation before a suspicious odometer jump', async () => {
    await initializeVehicle(1_000, true, initialAt)

    const result = await recordOdometer(1_500.1, laterAt)

    expect(result.kind).toBe('requires_confirmation')
    expect(result.kind === 'requires_confirmation' && result.deltaKm)
      .toBeCloseTo(500.1)
    await expect(listOdometerReadings()).resolves.toHaveLength(1)
  })

  it('saves a confirmed suspicious odometer jump', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(recordOdometer(1_500.1, laterAt, true)).resolves.toEqual({
      kind: 'saved',
    })
    await expect(listOdometerReadings()).resolves.toHaveLength(2)
  })

  it('derives estimated liters and snapshots the weekly reference', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 2_000,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toEqual({ kind: 'saved' })

    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({
        odometerKm: 1_100,
        amountCents: 2_000,
        estimatedLiters: 2.837,
        referencePricePerLiter: 7.05,
        referenceWeekStart: '2026-09-27',
        referenceWeekEnd: '2026-10-03',
        fullTank: false,
        syncStatus: 'pending',
      }),
    ])
    expect(priceStub.getFuelPriceReference).toHaveBeenCalledOnce()
  })

  it('uses the form reference snapshot instead of a newer cache value', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 2_888,
        fullTank: false,
        fueledAt: laterAt,
        priceReference,
      }),
    ).resolves.toEqual({ kind: 'saved' })

    expect(priceStub.getFuelPriceReference).not.toHaveBeenCalled()
    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({
        amountCents: 2_888,
        referencePricePerLiter: 7.05,
      }),
    ])
  })

  it('stores null estimation fields when no price reference is available', async () => {
    priceStub.getFuelPriceReference.mockResolvedValueOnce(null)
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 2_000,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toEqual({ kind: 'saved' })

    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({
        estimatedLiters: null,
        referencePricePerLiter: null,
        referenceWeekStart: null,
        referenceWeekEnd: null,
      }),
    ])
  })

  it('does not fail local recording when price lookup throws', async () => {
    priceStub.getFuelPriceReference.mockRejectedValueOnce(new Error('offline'))
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 2_000,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toEqual({ kind: 'saved' })

    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({ estimatedLiters: null }),
    ])
  })

  it('saves a full-tank entry even when the price reference is unavailable', async () => {
    priceStub.getFuelPriceReference.mockResolvedValueOnce(null)
    await initializeVehicle(1_000, false, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 2_000,
        fullTank: true,
        fueledAt: laterAt,
      }),
    ).resolves.toEqual({ kind: 'saved' })

    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({
        fullTank: true,
        estimatedLiters: null,
      }),
    ])
  })

  it('rejects a concurrent fuel write that becomes regressive', async () => {
    await initializeVehicle(1_000, true, initialAt)

    const [higher, lower] = await Promise.all([
      recordFuel({
        odometerKm: 1_100,
        amountCents: 2_000,
        fullTank: false,
        fueledAt: '2026-09-30T10:00:00.000Z',
      }),
      recordFuel({
        odometerKm: 1_050,
        amountCents: 2_000,
        fullTank: false,
        fueledAt: '2026-09-30T10:01:00.000Z',
      }),
    ])

    expect(higher).toEqual({ kind: 'saved' })
    expect(lower).toMatchObject({ kind: 'invalid' })
    expect((await listFuelEntries()).map(({ odometerKm }) => odometerKm)).toEqual([
      1_100,
    ])
    expect(
      (await listOdometerReadings()).map(({ readingKm }) => readingKm).sort(),
    ).toEqual([1_000, 1_100])
  })

  it('keeps refuel mileage only in the fuel entry', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(recordFuel({
      odometerKm: 1_100,
      amountCents: 2_000,
      fullTank: false,
      fueledAt: laterAt,
    })).resolves.toEqual({ kind: 'saved' })

    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({ odometerKm: 1_100 }),
    ])
    await expect(listOdometerReadings()).resolves.toEqual([
      expect.objectContaining({
        readingKm: 1_000,
        source: 'manual',
      }),
    ])
  })

  it('does not create a duplicate fuel-generated odometer reading', async () => {
    await initializeVehicle(1_000, true, initialAt)
    await recordFuel({
      odometerKm: 1_100,
      amountCents: 2_000,
      fullTank: true,
      fueledAt: laterAt,
    })

    expect(
      (await listOdometerReadings()).some(
        (reading) => reading.source === 'fuel_entry',
      ),
    ).toBe(false)
  })

  it('commits the fuel entry without a duplicate reading', async () => {
    await initializeVehicle(1_000, true, initialAt)
    await recordFuel({
      odometerKm: 1_100,
      amountCents: 2_000,
      fullTank: true,
      fueledAt: laterAt,
    })

    await expect(listFuelEntries()).resolves.toHaveLength(1)
    await expect(listOdometerReadings()).resolves.toHaveLength(2)
  })

  it.each([0, -1])('rejects amountCents=%s', async (amountCents) => {
    await expect(
      recordFuel({
        odometerKm: 1_000,
        amountCents,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toMatchObject({ kind: 'invalid' })
    await expect(listFuelEntries()).resolves.toEqual([])
    expect(priceStub.getFuelPriceReference).not.toHaveBeenCalled()
  })

  it('rejects a non-integer amount in cents', async () => {
    await expect(
      recordFuel({
        odometerKm: 1_000,
        amountCents: 10.5,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toMatchObject({ kind: 'invalid' })
    await expect(listFuelEntries()).resolves.toEqual([])
    expect(priceStub.getFuelPriceReference).not.toHaveBeenCalled()
  })

  it('rejects a regressive fuel odometer without writing', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 999,
        amountCents: 1_000,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toMatchObject({ kind: 'invalid' })
    await expect(listFuelEntries()).resolves.toEqual([])
    await expect(listOdometerReadings()).resolves.toHaveLength(1)
  })

  it('requires confirmation for a suspicious fuel odometer', async () => {
    await initializeVehicle(1_000, true, initialAt)

    const result = await recordFuel({
      odometerKm: 1_500.1,
      amountCents: 1_000,
      fullTank: false,
      fueledAt: laterAt,
    })

    expect(result.kind).toBe('requires_confirmation')
    expect(result.kind === 'requires_confirmation' && result.deltaKm)
      .toBeCloseTo(500.1)
    await expect(listFuelEntries()).resolves.toEqual([])
    await expect(listOdometerReadings()).resolves.toHaveLength(1)
  })

  it('does not report success when the fuel transaction fails', async () => {
    await initializeVehicle(1_000, true, initialAt)
    randomUUID
      .mockReturnValueOnce(nextUuid(100))
      .mockReturnValueOnce(
        undefined as unknown as ReturnType<Crypto['randomUUID']>,
      )

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 1_000,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).rejects.toBeDefined()
    await expect(listFuelEntries()).resolves.toEqual([])
    await expect(listOdometerReadings()).resolves.toHaveLength(1)
  })

  it('rejects malformed fuel values before price lookup or persistence', async () => {
    await expect(
      recordFuel({
        odometerKm: Number.NaN,
        amountCents: 1_000,
        fullTank: false,
        fueledAt: 'not-a-date',
      }),
    ).resolves.toMatchObject({ kind: 'invalid' })
    await expect(listFuelEntries()).resolves.toEqual([])
    expect(priceStub.getFuelPriceReference).not.toHaveBeenCalled()
  })
})


describe('vehicle practical limits', () => {
  beforeEach(async () => {
    await resetLocalDatabase()
    priceStub.getFuelPriceReference.mockReset()
    priceStub.getFuelPriceReference.mockResolvedValue(priceReference)
  })

  afterAll(async () => {
    await resetLocalDatabase()
  })

  it('rejects an initial odometer above 999999.0 km', async () => {
    await expect(
      initializeVehicle(999_999.1, false, initialAt),
    ).rejects.toBeInstanceOf(RangeError)
  })

  it('rejects an odometer update above 999999.0 km', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(recordOdometer(999_999.1, laterAt)).resolves.toMatchObject({
      kind: 'invalid',
    })
  })

  it('accepts an equal odometer and the technical maximum', async () => {
    await initializeVehicle(12_345.6, true, initialAt)

    await expect(recordOdometer(12_345.6, laterAt)).resolves.toEqual({
      kind: 'saved',
    })
    await expect(
      recordOdometer(999_999, '2026-10-01T10:00:00.000Z', true),
    ).resolves.toEqual({ kind: 'saved' })
  })

  it('accepts the exact dynamic fuel limit from the maximum retail price', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 3_249,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toEqual({ kind: 'saved' })
  })

  it('rejects one cent above the maximum-retail dynamic limit', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 3_250,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toMatchObject({ kind: 'invalid' })

    await expect(listFuelEntries()).resolves.toEqual([])
  })

  it('does not impose the dynamic cap when the price reference is unavailable', async () => {
    priceStub.getFuelPriceReference.mockResolvedValueOnce(null)
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 9_999,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toEqual({ kind: 'saved' })

    await expect(listFuelEntries()).resolves.toEqual([
      expect.objectContaining({ amountCents: 9_999, estimatedLiters: null }),
    ])
  })

  it('rejects values above the UI money ceiling even without a price reference', async () => {
    priceStub.getFuelPriceReference.mockResolvedValueOnce(null)
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 1_100,
        amountCents: 10_000,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toMatchObject({ kind: 'invalid' })

    await expect(listFuelEntries()).resolves.toEqual([])
  })

  it('rejects a fuel odometer above 999999.0 km', async () => {
    await initializeVehicle(1_000, true, initialAt)

    await expect(
      recordFuel({
        odometerKm: 999_999.1,
        amountCents: 2_000,
        fullTank: false,
        fueledAt: laterAt,
      }),
    ).resolves.toMatchObject({ kind: 'invalid' })
  })
})
