import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  getCachedSession,
  signOut,
  subscribeToAuth,
} from '../infrastructure/auth/session'
import {
  runSync,
  subscribeToSyncActivity,
} from '../infrastructure/sync/sync'
import ConnectionIndicator, {
  type ConnectionState,
} from '../shared/ui/ConnectionIndicator'
import VehicleModule from '../modules/vehicle/VehicleModule'
import LoginView from './LoginView'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [syncing, setSyncing] = useState(false)
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
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    const unsubscribe = subscribeToSyncActivity((activity) =>
      setSyncing(activity === 'syncing'),
    )

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
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

  const connectionState: ConnectionState = !online
    ? 'offline'
    : syncing
      ? 'syncing'
      : 'online'

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
            <div className="app__header-actions">
              <ConnectionIndicator state={connectionState} />
              <button className="app__signout" onClick={handleSignOut} type="button">
                Sair
              </button>
            </div>
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
