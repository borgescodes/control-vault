import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  getCachedSession,
  signOut,
  subscribeToAuth,
} from '../infrastructure/auth/session'
import LoginView from './LoginView'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let active = true
    const unsubscribe = subscribeToAuth((nextSession) => {
      if (active) {
        setSession(nextSession)
        setSessionReady(true)
      }
    })

    void getCachedSession()
      .then((cachedSession) => {
        if (active) {
          setSession(cachedSession)
        }
      })
      .catch(() => {
        if (active) {
          setSession(null)
        }
      })
      .finally(() => {
        if (active) {
          setSessionReady(true)
        }
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  return (
    <main className="app">
      <h1>Control Vault</h1>
      {sessionReady &&
        (session ? (
          <button onClick={handleSignOut} type="button">
            Sair
          </button>
        ) : (
          <LoginView />
        ))}
    </main>
  )
}
