import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../supabase/client', () => ({
  supabase: { auth },
}))

import { getCachedSession, signIn } from './session'

describe('session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns_null_when_no_cached_session_exists', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    await expect(getCachedSession()).resolves.toBeNull()
  })

  it('keeps_local_app_state_available_when_network_is_offline_but_cached_session_exists', async () => {
    const session = { access_token: 'cached' } as Session
    const localState = new Map([['odometer', 12_345]])
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })
    auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    })

    await expect(getCachedSession()).resolves.toBe(session)
    expect(localState.get('odometer')).toBe(12_345)
  })

  it('sign_in_surfaces_auth_error_without_mutating_local_data', async () => {
    const authError = new Error('Invalid login credentials')
    const localState = new Map([['pending-fuel-entry', 'local-only']])
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: authError,
    })

    await expect(signIn('owner@example.com', 'wrong-password')).rejects.toBe(authError)
    expect(localState.get('pending-fuel-entry')).toBe('local-only')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'wrong-password',
    })
  })
})
