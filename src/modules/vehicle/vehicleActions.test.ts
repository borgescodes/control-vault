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
      nominalTankCapacityLiters: 3,
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
      nominalTankCapacityLiters: 3,
      initialFullTankAt: initialAt,
    })
  })

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
    ).toEqual([1_000, 1_100])
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

  it('marks the odometer reading generated by fuel as fuel_entry', async () => {
    await initializeVehicle(1_000, true, initialAt)
    await recordFuel({
      odometerKm: 1_100,
      amountCents: 2_000,
      fullTank: true,
      fueledAt: laterAt,
    })

    expect(await listOdometerReadings()).toContainEqual(
      expect.objectContaining({
        readingKm: 1_100,
        recordedAt: laterAt,
        source: 'fuel_entry',
      }),
    )
  })

  it('commits the fuel entry and reading together', async () => {
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
