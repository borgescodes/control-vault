import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  getCachedSession,
  signOut,
  subscribeToAuth,
} from '../infrastructure/auth/session'
import { runSync } from '../infrastructure/sync/sync'
import VehicleModule from '../modules/vehicle/VehicleModule'
import LoginView from './LoginView'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [vehicleReadyForUser, setVehicleReadyForUser] = useState<string | null>(
    null,
  )

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
        if (active) setSession(cachedSession)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setSessionReady(true)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setVehicleReadyForUser(null)
      return
    }

    let active = true
    const syncWhileOnline = () => {
      if (navigator.onLine) {
        void runSync(session.user.id).catch(() => undefined)
      }
    }

    void (async () => {
      try {
        if (navigator.onLine) await runSync(session.user.id)
      } catch {
        // Local data remains authoritative when remote sync is unavailable.
      } finally {
        if (active) setVehicleReadyForUser(session.user.id)
      }
    })()

    window.addEventListener('online', syncWhileOnline)
    return () => {
      active = false
      window.removeEventListener('online', syncWhileOnline)
    }
  }, [session])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  return (
    <main className="app">
      <section className="app__shell">
        <header className="app__header">
          <h1>CONTROL VAULT</h1>
          {session && (
            <button className="app__signout" onClick={handleSignOut} type="button">
              Sair
            </button>
          )}
        </header>
        <div className="app__content">
          {sessionReady &&
            (session ? (
              vehicleReadyForUser === session.user.id && <VehicleModule />
            ) : (
              <LoginView />
            ))}
        </div>
      </section>
    </main>
  )
}
