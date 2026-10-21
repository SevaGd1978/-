import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { dateRu, money } from '../format'
import { GIBDD_SITE, normalizeSts, splitPlate, stsLooksValid, type GibddFine } from '../gibdd'
import { useData } from '../store'
import { Empty } from '../ui'

export function FinesPage() {
  const { state, saveVehicle } = useData()
  const { can } = useAuth()
  const [stsById, setStsById] = useState<Record<string, string>>(() =>
    Object.fromEntries(state.vehicles.map((vehicle) => [vehicle.id, vehicle.sts])),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [captcha, setCaptcha] = useState<{ id: string; image: string } | null>(null)
  const [word, setWord] = useState('')
  const [fines, setFines] = useState<GibddFine[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const active = state.vehicles.find((vehicle) => vehicle.id === activeId) ?? null

  function stsOf(id: string, stored: string) {
    return stsById[id] ?? stored
  }

  async function openCheck(id: string) {
    const vehicle = state.vehicles.find((item) => item.id === id)
    if (!vehicle) return
    const sts = normalizeSts(stsOf(id, vehicle.sts))
    if (!splitPlate(vehicle.plate)) {
      setActiveId(id)
      setCaptcha(null)
      setFines(null)
      setError('Госномер не разобран. Нужен формат А123ВС 116.')
      return
    }
    if (!stsLooksValid(sts)) {
      setActiveId(id)
      setCaptcha(null)
      setFines(null)
      setError('Укажите номер СТС: 8–12 символов, как в свидетельстве о регистрации.')
      return
    }
    if (can('fleet') && sts !== vehicle.sts) {
      await saveVehicle({ ...vehicle, sts })
    }
    setActiveId(id)
    setFines(null)
    await loadCaptcha()
  }

  async function loadCaptcha() {
    setPending(true)
    setError('')
    setWord('')
    try {
      const response = await fetch('/api/gibdd/captcha')
      const body = (await response.json()) as { id?: string; image?: string; error?: string }
      if (!response.ok || !body.id || !body.image) {
        setCaptcha(null)
        setError(body.error || 'Госавтоинспекция не выдала картинку для проверки.')
        return
      }
      setCaptcha({ id: body.id, image: body.image })
    } catch {
      setCaptcha(null)
      setError('Сервис Госавтоинспекции не ответил. Повторите проверку чуть позже.')
    } finally {
      setPending(false)
    }
  }

  async function submitCheck(event: FormEvent) {
    event.preventDefault()
    if (!active || !captcha) return
    const sts = normalizeSts(stsOf(active.id, active.sts))
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/gibdd/fines', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plate: active.plate, sts, sessionId: captcha.id, captchaWord: word }),
      })
      const body = (await response.json()) as { ok?: boolean; fines?: GibddFine[]; error?: string; retryCaptcha?: boolean }
      if (!response.ok || !body.ok) {
        setFines(null)
        const text = body.error || 'Госавтоинспекция не отдала список штрафов.'
        if (body.retryCaptcha) await loadCaptcha()
        setError(text)
        return
      }
      setFines(body.fines ?? [])
      setCaptcha(null)
    } catch {
      setError('Сервис Госавтоинспекции не ответил. Повторите проверку чуть позже.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="section-head">
          <h2>Штрафы ГИБДД</h2>
        </div>
        <p className="hint">
          Неоплаченные штрафы запрашиваются у Госавтоинспекции на сервисе.гибдд.рф. Нужны госномер машины и номер СТС.
          Картинку с кодом вводит человек, как на{' '}
          <a href={GIBDD_SITE} target="_blank" rel="noreferrer">
            сайте проверки
          </a>
          .
        </p>
        {state.vehicles.length === 0 ? (
          <Empty title="В парке нет машин" text="Добавьте машину в разделе «Парк», затем вернитесь к проверке." />
        ) : (
          <div className="table-wrap">
            <table className="fleet-sheet">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Модель</th>
                  <th>СТС</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.vehicles.map((vehicle) => (
                  <tr key={vehicle.id} aria-selected={vehicle.id === activeId}>
                    <td>
                      <strong>{vehicle.plate}</strong>
                    </td>
                    <td>{vehicle.model}</td>
                    <td>
                      <input
                        className="fines-sts"
                        aria-label={`СТС ${vehicle.plate}`}
                        value={stsOf(vehicle.id, vehicle.sts)}
                        placeholder="9912345678"
                        onChange={(event) => setStsById((current) => ({ ...current, [vehicle.id]: event.target.value }))}
                      />
                    </td>
                    <td>
                      <button type="button" className="btn small" disabled={pending} onClick={() => void openCheck(vehicle.id)}>
                        Проверить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {active ? (
        <section className="card" aria-label={`Проверка ${active.plate}`}>
          <div className="section-head">
            <h2>{active.plate}</h2>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {captcha ? (
            <form className="fines-captcha" onSubmit={(event) => void submitCheck(event)}>
              <img src={captcha.image} alt="Код Госавтоинспекции" />
              <label className="field">
                <span>Код с картинки</span>
                <input value={word} onChange={(event) => setWord(event.target.value)} autoComplete="off" autoFocus />
              </label>
              <button type="submit" className="btn primary" disabled={pending || word.trim().length < 3}>
                Показать штрафы
              </button>
              <button type="button" className="btn ghost" disabled={pending} onClick={() => void loadCaptcha()}>
                Другая картинка
              </button>
            </form>
          ) : null}
          {fines ? (
            fines.length === 0 ? (
              <Empty title="Неоплаченных штрафов нет" text={`${active.plate}: Госавтоинспекция не нашла постановлений.`} />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Постановление</th>
                      <th>Нарушение</th>
                      <th>Подразделение</th>
                      <th className="num">Сумма</th>
                      <th>Скидка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fines.map((fine) => (
                      <tr key={fine.number || `${fine.date}-${fine.amount}`}>
                        <td>{dateRu(fine.date)}</td>
                        <td>{fine.number || '—'}</td>
                        <td>{fine.article || '—'}</td>
                        <td>{fine.division || '—'}</td>
                        <td className="num">{money(fine.amount)}</td>
                        <td>{fine.discount || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
