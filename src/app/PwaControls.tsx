import { useEffect, useRef, useState } from 'react'
import { registerPwa } from '../infrastructure/pwa/register'

type InstallPrompt = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function PwaControls({
  active = true,
  onUpdateState,
}: {
  active?: boolean
  onUpdateState?: (pending: boolean) => void
}) {
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && isStandalone())
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [instructions, setInstructions] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const update = useRef<(() => Promise<void>) | undefined>(undefined)

  useEffect(() => {
    const control = registerPwa((pending) => {
      setUpdateAvailable(pending)
      onUpdateState?.(pending)
    })
    update.current = control.update
    const beforeInstall = (event: Event) => {
      if (isStandalone()) return
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    const appInstalled = () => { setInstalled(true); setPrompt(null); setInstructions(false) }
    const displayMode = window.matchMedia?.('(display-mode: standalone)')
    const displayChanged = () => {
      const standalone = isStandalone()
      setInstalled(standalone)
      if (standalone) { setPrompt(null); setInstructions(false) }
    }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', appInstalled)
    displayMode?.addEventListener('change', displayChanged)
    return () => {
      control.dispose()
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', appInstalled)
      displayMode?.removeEventListener('change', displayChanged)
    }
  }, [onUpdateState])

  async function install() {
    if (!prompt) { setInstructions((shown) => !shown); return }
    setBusy(true); setError(null); setPrompt(null)
    try {
      await prompt.prompt()
      if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true)
    } catch { setError('Instalação não concluída') }
    finally { setBusy(false) }
  }

  if (!active) return null

  return <div className="app__pwa">
    {!installed && (prompt || isIOS()) && <button type="button" disabled={busy} onClick={() => void install()}>Instalar app</button>}
    {updateAvailable && <button type="button" disabled={busy} onClick={() => {
      setBusy(true)
      void update.current?.().catch(() => setError('Atualização não concluída')).finally(() => setBusy(false))
    }}>Atualizar app</button>}
    {instructions && !installed && <p role="status">No Safari, abra Compartilhar e escolha Adicionar à Tela de Início.</p>}
    {error && <p role="alert">{error}</p>}
  </div>
}
