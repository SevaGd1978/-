import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { Field } from '../ui'

export function LoginPage({ setup }: { setup: boolean }) {
  const { login, createFirst } = useAuth()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (setup && password !== again) {
      setError('Пароли не совпадают')
      return
    }
    setBusy(true)
    const message = setup
      ? await createFirst({ username, name, password, rights: [] })
      : await login(username, password)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={(event) => void onSubmit(event)}>
        <p className="eyebrow">Путевой</p>
        <h1>{setup ? 'Первая учётная запись' : 'Вход'}</h1>
        <p className="hint">
          {setup
            ? 'Её создаёт тот, кто открыл пустую базу. Она сразу получает все права, в том числе создание остальных людей.'
            : 'Войдите под своей учётной записью. Общая база одна на всех.'}
        </p>
        <div className="form-grid">
          {setup ? (
            <Field label="Имя" wide>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </Field>
          ) : null}
          <Field label="Логин" wide>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Пароль" wide>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={setup ? 'new-password' : 'current-password'}
              required
              minLength={8}
            />
          </Field>
          {setup ? (
            <Field label="Пароль ещё раз" wide>
              <input
                type="password"
                value={again}
                onChange={(event) => setAgain(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>
          ) : null}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-actions">
          <span />
          <button type="submit" className="btn primary" disabled={busy}>
            {setup ? 'Создать администратора' : 'Войти'}
          </button>
        </div>
      </form>
    </div>
  )
}
