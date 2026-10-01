import { beforeEach, describe, expect, it, vi } from 'vitest'

const storeStub = vi.hoisted(() => ({
  saveSavedTrip: vi.fn().mockResolvedValue(undefined),
  softDeleteSavedTrip: vi.fn().mockResolvedValue(true),
}))
const syncStub = vi.hoisted(() => ({
  syncCurrentSessionIfOnline: vi.fn().mockResolvedValue(undefined),
}))
const uuidStub = vi.hoisted(() => ({
  createUuid: vi.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
}))

vi.mock('../../infrastructure/local/store', () => storeStub)
vi.mock('../../infrastructure/sync/sync', () => syncStub)
vi.mock('../../shared/uuid', () => uuidStub)

import { createSavedTrip, deleteSavedTrip, updateSavedTrip } from './savedTripActions'

const now = '2026-10-01T18:00:00.000Z'

describe('saved trip actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a normalized local-first trip and requests sync', async () => {
    const result = await createSavedTrip(
      {
        origin: '  Casa  ',
        destination: 'Juparanã',
        outboundDistanceKm: 14.04,
        returnDistanceKm: 16.06,
      },
      now,
    )

    expect(result).toEqual({
      kind: 'saved',
      trip: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        origin: 'Casa',
        destination: 'Juparanã',
        outboundDistanceKm: 14,
        returnDistanceKm: 16.1,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    })
    expect(storeStub.saveSavedTrip).toHaveBeenCalledWith(result.kind === 'saved' ? result.trip : undefined)
    expect(syncStub.syncCurrentSessionIfOnline).toHaveBeenCalledOnce()
  })

  it('edits the same id and preserves createdAt', async () => {
    const existing = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      origin: 'Casa',
      destination: 'Trabalho',
      outboundDistanceKm: 8,
      returnDistanceKm: null,
      deletedAt: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    }

    const result = await updateSavedTrip(
      existing,
      {
        origin: 'Casa',
        destination: 'Trabalho',
        outboundDistanceKm: 8.4,
        returnDistanceKm: 9.1,
      },
      now,
    )

    expect(result).toEqual({
      kind: 'saved',
      trip: expect.objectContaining({
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now,
        outboundDistanceKm: 8.4,
        returnDistanceKm: 9.1,
      }),
    })
  })

  it('rejects missing labels and non-positive distances', async () => {
    await expect(
      createSavedTrip(
        {
          origin: '',
          destination: 'Destino',
          outboundDistanceKm: 0,
          returnDistanceKm: null,
        },
        now,
      ),
    ).resolves.toEqual({ kind: 'invalid', reason: 'Dados do percurso inválidos' })
    expect(storeStub.saveSavedTrip).not.toHaveBeenCalled()
  })

  it('soft-deletes and requests sync', async () => {
    await expect(deleteSavedTrip('trip-id', now)).resolves.toBe(true)
    expect(storeStub.softDeleteSavedTrip).toHaveBeenCalledWith('trip-id', now)
    expect(syncStub.syncCurrentSessionIfOnline).toHaveBeenCalledOnce()
  })
})
