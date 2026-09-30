import { afterEach, describe, expect, it, vi } from 'vitest'

import { createUuid } from './uuid'

const originalRandomUUID = globalThis.crypto.randomUUID

describe('createUuid', () => {
  afterEach(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: originalRandomUUID,
    })
    vi.restoreAllMocks()
  })

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-4111-8111-111111111111')

    expect(createUuid()).toBe('11111111-1111-4111-8111-111111111111')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    })
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((array) => {
        const bytes = array as Uint8Array
        bytes.fill(0x11)
        return array
      })

    expect(createUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(getRandomValues).toHaveBeenCalledOnce()
  })
})
