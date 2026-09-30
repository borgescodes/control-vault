export type ConnectionState = 'online' | 'offline' | 'syncing'

const labels: Record<ConnectionState, string> = {
  online: 'Online',
  offline: 'Offline',
  syncing: 'Sincronizando',
}

export default function ConnectionIndicator({
  state,
}: {
  state: ConnectionState
}) {
  return (
    <span
      aria-label={labels[state]}
      className="app__connection"
      data-state={state}
      role="status"
    />
  )
}
