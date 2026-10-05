import packageJson from '../../../package.json'

type SettingsViewProps = {
  tankCapacityLiters: number
  statusNotificationEnabled: boolean
  onTankCapacity: () => void
  onEnableStatusNotification?: () => void
}

const liters = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export default function SettingsView({
  tankCapacityLiters,
  statusNotificationEnabled,
  onTankCapacity,
  onEnableStatusNotification,
}: SettingsViewProps) {
  return (
    <section
      aria-labelledby="settings-title"
      className="settings"
      data-view-root="true"
      tabIndex={-1}
    >
      <header className="settings__header">
        <h2 id="settings-title">Configurações</h2>
      </header>

      <div className="settings__list">
        <button onClick={onTankCapacity} type="button">
          <span>Capacidade do tanque</span>
          <span className="settings__value">
            {liters.format(tankCapacityLiters)} L
          </span>
        </button>

        {statusNotificationEnabled ? (
          <div className="settings__row">
            <span>Resumo</span>
            <span className="settings__value">Ativo</span>
          </div>
        ) : (
          onEnableStatusNotification && (
            <button onClick={onEnableStatusNotification} type="button">
              Ativar resumo
            </button>
          )
        )}
      </div>

      <dl className="settings__meta">
        <div>
          <dt>Versão</dt>
          <dd>{packageJson.version}</dd>
        </div>
        <div>
          <dt>Autor</dt>
          <dd>{packageJson.author}</dd>
        </div>
      </dl>
    </section>
  )
}
