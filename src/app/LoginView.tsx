import { useState, type FormEvent } from 'react'
import { signIn } from '../infrastructure/auth/session'

export default function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await signIn(email, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao entrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      aria-labelledby="login-title"
      className="auth-form"
      data-view-root="true"
      onSubmit={handleSubmit}
      tabIndex={-1}
    >
      <header className="auth-form__header">
        <h2 id="login-title">Acesso</h2>
      </header>

      <label>
        Email
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label>
        Senha
        <input
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {error && <p className="vehicle-alert" role="alert">{error}</p>}

      <button
        aria-busy={submitting}
        className="button-primary"
        disabled={submitting}
        type="submit"
      >
        {submitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
