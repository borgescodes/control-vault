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
  type SyncActivity,
} from '../infrastructure/sync/sync'
import { claimSyncOwner, listPending, subscribeToLocalChanges } from '../infrastructure/local/store'
import ConnectionIndicator, {
  type ConnectionState,
} from '../shared/ui/ConnectionIndicator'
import VehicleModule from '../modules/vehicle/VehicleModule'
import LoginView from './LoginView'
import PwaControls from './PwaControls'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [syncActivity, setSyncActivity] = useState<SyncActivity>('unconfirmed')
  const [pendingCount, setPendingCount] = useState(0)
  const [syncError, setSyncError] = useState(false)
  const [updatePending, setUpdatePending] = useState(false)
  const [localAccessError, setLocalAccessError] = useState<string | null>(null)
  const [vehicleReadyForUser, setVehicleReadyForUser] = useState<string | null>(
    null,
  )

  useEffect(() => {
    let active = true
    let authChanged = false
    const unsubscribe = subscribeToAuth((nextSession) => {
      if (active) {
        authChanged = true
        setSession(nextSession)
        setSessionReady(true)
      }
    })

    void getCachedSession()
      .then((cachedSession) => {
        if (active && !authChanged) setSession(cachedSession)
      })
      .catch(() => {
        if (active && !authChanged) setSession(null)
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
    const handleOnline = () => { setOnline(true); setSyncActivity('unconfirmed') }
    const handleOffline = () => { setOnline(false); setSyncActivity('unconfirmed') }
    const unsubscribe = subscribeToSyncActivity((activity) => {
      setSyncActivity(activity)
      setSyncError(activity === 'error')
    })

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
    let localAllowed = false
    let resumeTimer: number | undefined
    let countRequest = 0
    const refreshPending = () => {
      if (!localAllowed) return
      const request = ++countRequest
      void listPending().then((records) => {
        if (active && request === countRequest) setPendingCount(records.length)
      }).catch(() => { if (active) setSyncError(true) })
    }
    const syncWhileOnline = () => {
      if (navigator.onLine && localAllowed) {
        setSyncActivity('syncing')
        void runSync(session.user.id).then((result) => {
          if (!active) return
          setSyncError(result.failed > 0)
          setSyncActivity(result.failed > 0 ? 'error' : result.pending > 0 ? 'pending' : 'idle')
          refreshPending()
        }).catch(() => {
          if (active) { setSyncError(true); setSyncActivity('error') }
        })
      }
    }
    const scheduleResume = () => {
      window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(syncWhileOnline, 60)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleResume()
    }
    const unsubscribeLocal = subscribeToLocalChanges((change) => {
      refreshPending()
      if (change === 'write') setSyncActivity('pending')
    })
    setVehicleReadyForUser(null)
    setLocalAccessError(null)
    setPendingCount(0)
    setSyncActivity('unconfirmed')
    setSyncError(false)

    void (async () => {
      try {
        await claimSyncOwner(session.user.id)
        if (!active) return
        localAllowed = true
        refreshPending()
        if (navigator.onLine) {
          setSyncActivity('syncing')
          const result = await runSync(session.user.id)
          if (active) {
            setSyncError(result.failed > 0)
            setSyncActivity(result.failed > 0 ? 'error' : result.pending > 0 ? 'pending' : 'idle')
          }
        }
      } catch (cause) {
        if (active) {
          setSyncError(true)
          setSyncActivity('error')
          if (!localAllowed) setLocalAccessError(cause instanceof Error ? cause.message : 'Falha ao abrir dados locais')
        }
      } finally {
        if (active && localAllowed) { setVehicleReadyForUser(session.user.id); refreshPending() }
      }
    })()

    window.addEventListener('online', scheduleResume)
    window.addEventListener('focus', scheduleResume)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      active = false
      window.clearTimeout(resumeTimer)
      unsubscribeLocal()
      window.removeEventListener('online', scheduleResume)
      window.removeEventListener('focus', scheduleResume)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [session?.user.id])

  const connectionState: ConnectionState = !online
    ? 'offline'
    : syncActivity !== 'idle' || syncError || pendingCount > 0 || updatePending
      ? 'syncing'
      : 'online'

  async function handleSignOut() {
    try {
      await signOut()
      setSession(null)
    } catch { setSyncError(true) }
  }

  return (
    <main className="app">
      <section className="app__shell">
        <header className="app__header">
          <div className="app__brand">
            <img src="/logo.png" alt="" width="32" height="32" />
            <h1>CONTROL VAULT</h1>
          </div>
          {session && (
            <div className="app__header-actions">
              <ConnectionIndicator state={connectionState} />
              <button className="app__signout" onClick={handleSignOut} type="button">
                Sair
              </button>
            </div>
          )}
        </header>
        <PwaControls onUpdateState={setUpdatePending} />
        {session && (syncError || pendingCount > 0) && (
          <div className="app__sync-feedback" role="status">
            <span>{syncError ? 'Sincronização não concluída' : `${pendingCount} pendente${pendingCount === 1 ? '' : 's'} de sincronização`}</span>
            {online && <button type="button" onClick={() => {
              void runSync(session.user.id).catch(() => setSyncError(true))
            }}>Tentar novamente</button>}
          </div>
        )}
        <div className="app__content">
          {sessionReady &&
            (session ? (
              localAccessError ? <p className="vehicle-alert" role="alert">{localAccessError}</p> :
                vehicleReadyForUser === session.user.id && <VehicleModule />
            ) : (
              <LoginView />
            ))}
        </div>
      </section>
    </main>
  )
}
