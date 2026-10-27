import { randomBytes } from 'node:crypto'
import {
  GIBDD_CAPTCHA_URL,
  GIBDD_FINES_URL,
  finesForm,
  parseGibddPayload,
  type GibddAnswer,
} from '../src/gibdd.ts'

const GIBDD_REFERER = 'https://xn--80aebkobnwfcnsfk1e0h.xn--p1ai/check/fines'
const TIMEOUT_MS = 20_000

interface CaptchaSession {
  token: string
  cookie: string
  at: number
}

const sessions = new Map<string, CaptchaSession>()

export async function issueCaptcha(): Promise<{ id: string; image: string } | { error: string }> {
  pruneSessions()
  try {
    const response = await fetch(GIBDD_CAPTCHA_URL, {
      headers: gibddHeaders({ Accept: 'application/json, image/jpeg, */*' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return { error: 'Госавтоинспекция не выдала картинку для проверки.' }
    const cookie = cookieHeader(response)
    const type = response.headers.get('content-type') || ''
    if (type.includes('json') || type.includes('text') || type.includes('javascript')) {
      const body = (await response.json()) as { token?: unknown; base64jpg?: unknown; image?: unknown }
      const token = typeof body.token === 'string' ? body.token : ''
      const raw = typeof body.base64jpg === 'string' ? body.base64jpg : typeof body.image === 'string' ? body.image : ''
      const cleaned = raw.replace(/\s+/g, '')
      if (!cleaned) return { error: 'Госавтоинспекция не выдала картинку для проверки.' }
      const image = cleaned.startsWith('data:') ? cleaned : `data:image/jpeg;base64,${cleaned}`
      return { id: storeSession(token, cookie), image }
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length) return { error: 'Госавтоинспекция не выдала картинку для проверки.' }
    return { id: storeSession('', cookie), image: `data:image/jpeg;base64,${bytes.toString('base64')}` }
  } catch {
    return { error: 'Сервис Госавтоинспекции не ответил. Повторите проверку чуть позже.' }
  }
}

export async function checkGibddFines(input: {
  sessionId: string
  captchaWord: string
  regnum: string
  regreg: string
  sts: string
}): Promise<GibddAnswer> {
  const session = sessions.get(input.sessionId)
  if (!session) {
    return { ok: false, error: 'Картинка устарела. Запросите новую.', retryCaptcha: true }
  }
  const form = finesForm({
    regnum: input.regnum,
    regreg: input.regreg,
    sts: input.sts,
    captchaWord: input.captchaWord,
    captchaToken: session.token,
  })
  try {
    const response = await fetch(GIBDD_FINES_URL, {
      method: 'POST',
      headers: gibddHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      }),
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const text = await response.text()
    if (!response.ok) {
      return { ok: false, error: 'Госавтоинспекция не отдала список штрафов.', retryCaptcha: false }
    }
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      return { ok: false, error: 'Госавтоинспекция ответила в неожиданном виде.', retryCaptcha: false }
    }
    const parsed = parseGibddPayload(payload)
    if (!parsed.ok && parsed.retryCaptcha) sessions.delete(input.sessionId)
    return parsed
  } catch {
    return { ok: false, error: 'Сервис Госавтоинспекции не ответил. Повторите проверку чуть позже.', retryCaptcha: false }
  }
}

function gibddHeaders(extra: Record<string, string>) {
  return {
    'User-Agent': 'Mozilla/5.0',
    Referer: GIBDD_REFERER,
    'Accept-Language': 'ru',
    ...extra,
  }
}

function cookieHeader(response: Response) {
  const listed = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  return listed.map((item) => item.split(';')[0]).filter(Boolean).join('; ')
}

function storeSession(token: string, cookie: string) {
  const id = randomBytes(16).toString('hex')
  sessions.set(id, { token, cookie, at: Date.now() })
  return id
}

function pruneSessions() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.at > 10 * 60 * 1000) sessions.delete(id)
  }
}
