import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PublicUser, Right } from './access'
import { onUnauthorized } from './session'

interface AuthApi {
  user: PublicUser | null
  ready: boolean
  needsSetup: boolean
  can: (right: Right) => boolean
  login: (username: string, password: string) => Promise<string | null>
  createFirst: (input: AccountInput) => Promise<string | null>
  logout: () => Promise<void>
  reload: () => Promise<void>
}

export interface AccountInput {
  username: string
  name: string
  password: string
  rights: Right[]
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [ready, setReady] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  const reload = useCallback(async () => {
    const response = await fetch('/api/session')
    if (!response.ok) throw new Error(String(response.status))
    const body = (await response.json()) as { user: PublicUser | null; needsSetup: boolean }
    setUser(body.user)
    setNeedsSetup(Boolean(body.needsSetup))
    setReady(true)
  }, [])

  useEffect(() => {
    void reload().catch(() => setReady(true))
  }, [reload])

  useEffect(() => {
    return onUnauthorized(() => {
      setUser(null)
      setReady(true)
    })
  }, [])

  async function login(username: string, password: string) {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const body = (await response.json().catch(() => null)) as { user?: PublicUser; error?: string } | null
    if (!response.ok || !body?.user) return body?.error || 'Не удалось войти'
    setUser(body.user)
    setNeedsSetup(false)
    return null
  }

  async function createFirst(input: AccountInput) {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = (await response.json().catch(() => null)) as { user?: PublicUser; error?: string } | null
    if (!response.ok || !body?.user) return body?.error || 'Не удалось создать учётную запись'
    setUser(body.user)
    setNeedsSetup(false)
    return null
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    setUser(null)
  }

  const api: AuthApi = {
    user,
    ready,
    needsSetup,
    can: (right) => Boolean(user?.rights.includes(right)),
    login,
    createFirst,
    logout,
    reload,
  }

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth вызван вне AuthProvider')
  return context
}
