import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    throw error
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getCachedSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export function subscribeToAuth(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return () => data.subscription.unsubscribe()
}
