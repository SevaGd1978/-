import { useEffect, useState } from 'react'
import { PRESETS, RIGHTS, presetFor, rightLabel, sameRights, type PublicUser, type Right } from '../access'
import { useAuth } from '../auth'
import { dateRu } from '../format'
import { ConfirmDialog, Drawer, Empty, Field } from '../ui'

interface Editor {
  id: string | null
  name: string
  username: string
  password: string
  rights: Right[]
}

interface BackupRow {
  name: string
  date: string
  size: number
  mtime: string
}

interface BackupSchedule {
  hour: number
  timeZone: string
  keepDays: number
  dir: string
}

const BLANK: Editor = { id: null, name: '', username: '', password: '', rights: PRESETS[1].rights.slice() }

export function AccountsPage() {
  const { user, reload } = useAuth()
  const [users, setUsers] = useState<PublicUser[]>([])
  const [editor, setEditor] = useState<Editor | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null)
  const [preset, setPreset] = useState('dispatcher')
  const [backups, setBackups] = useState<BackupRow[]>([])
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)

  async function load() {
    const response = await fetch('/api/users')
    if (!response.ok) return
    const body = (await response.json()) as { users: PublicUser[] }
    setUsers(body.users)
  }

  async function loadBackups() {
    const response = await fetch('/api/backups')
    if (!response.ok) return
    const body = (await response.json()) as { backups: BackupRow[]; schedule: BackupSchedule }
    setBackups(body.backups)
    setSchedule(body.schedule)
  }

  useEffect(() => {
    void load()
    void loadBackups()
  }, [])

  function openNew() {
    const rights = PRESETS[1].rights.slice()
    setPreset('dispatcher')
    setError('')
    setEditor({ ...BLANK, rights })
  }

  function openExisting(account: PublicUser) {
    setPreset(presetFor(account.rights))
    setError('')
    setEditor({
      id: account.id,
      name: account.name,
      username: account.username,
      password: '',
      rights: account.rights.slice(),
    })
  }

  function choosePreset(id: string) {
    setPreset(id)
    const next = PRESETS.find((item) => item.id === id)
    if (next && id !== 'custom' && editor) setEditor({ ...editor, rights: next.rights.slice() })
  }

  function toggle(right: Right) {
    if (!editor) return
    const rights = editor.rights.includes(right) ? editor.rights.filter((item) => item !== right) : [...editor.rights, right]
    setEditor({ ...editor, rights })
    setPreset(presetFor(rights))
  }

  async function save() {
    if (!editor) return
    setError('')
    const payload = {
      name: editor.name,
      username: editor.username,
      password: editor.password,
      rights: editor.rights,
    }
    const response = await fetch(editor.id ? `/api/users/${editor.id}` : '/api/users', {
      method: editor.id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) {
      setError(body?.error || 'Не удалось сохранить')
      return
    }
    setEditor(null)
    await reload()
    await load()
  }

  async function remove(id: string) {
    const response = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) {
      setError(body?.error || 'Не удалось удалить')
      return
    }
    if (editor?.id === id) setEditor(null)
    await reload()
    await load()
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <p className="hint">Права ограничивают запись. Смотреть рейсы и деньги может любой, кто вошёл.</p>
        <button type="button" className="btn primary" onClick={openNew}>
          Новая учётная запись
        </button>
      </div>
      {error && !editor ? <p className="form-error">{error}</p> : null}
      <section className="card">
        {users.length === 0 ? (
          <Empty title="Учётных записей нет" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Логин</th>
                  <th>Права</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((account) => (
                  <tr key={account.id}>
                    <td>
                      {account.name}
                      {account.id === user?.id ? <span className="badge tone-slate">это вы</span> : null}
                    </td>
                    <td>{account.username}</td>
                    <td>{account.rights.length ? account.rights.map(rightLabel).join(', ') : 'только просмотр'}</td>
                    <td className="row-actions">
                      <button type="button" className="text-btn" onClick={() => openExisting(account)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="text-btn danger-text"
                        onClick={() => setConfirm({ id: account.id, name: account.name })}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card">
        <div className="section-head">
          <h2>Резервные копии</h2>
          <div className="row-actions">
            <a className="btn ghost small" href="/api/backup">
              Скачать текущую базу
            </a>
            <button
              type="button"
              className="btn primary small"
              disabled={backupBusy}
              onClick={() => {
                void (async () => {
                  setBackupBusy(true)
                  setError('')
                  try {
                    const response = await fetch('/api/backups', { method: 'POST' })
                    const body = (await response.json().catch(() => null)) as {
                      error?: string
                      backups?: BackupRow[]
                    } | null
                    if (!response.ok) {
                      setError(body?.error || 'Не удалось создать бэкап')
                      return
                    }
                    if (body?.backups) setBackups(body.backups)
                    else await loadBackups()
                  } finally {
                    setBackupBusy(false)
                  }
                })()
              }}
            >
              {backupBusy ? 'Сохраняем…' : 'Сделать снимок сейчас'}
            </button>
          </div>
        </div>
        <p className="hint">
          Автоматически каждый день после {schedule ? `${String(schedule.hour).padStart(2, '0')}:00` : '02:00'} (
          {schedule?.timeZone || 'Asia/Yekaterinburg'}). Хранятся последние {schedule?.keepDays ?? 14} копий на диске
          сервера.
        </p>
        {backups.length === 0 ? (
          <Empty title="Снимков пока нет" text="Первый появится по расписанию или после кнопки «Сделать снимок сейчас»." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Файл</th>
                  <th className="num">Размер</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {backups.map((item) => (
                  <tr key={item.name}>
                    <td>{dateRu(item.date)}</td>
                    <td>{item.name}</td>
                    <td className="num">{formatBytes(item.size)}</td>
                    <td className="row-actions">
                      <a className="text-btn" href={`/api/backups/${encodeURIComponent(item.name)}`}>
                        Скачать
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editor ? (
        <Drawer title={editor.id ? 'Учётная запись' : 'Новая учётная запись'} onClose={() => setEditor(null)}>
          <div className="form-grid">
            <Field label="Имя" wide>
              <input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} />
            </Field>
            <Field label="Логин" wide>
              <input
                value={editor.username}
                onChange={(event) => setEditor({ ...editor, username: event.target.value })}
                autoComplete="off"
              />
            </Field>
            <Field label={editor.id ? 'Новый пароль' : 'Пароль'} wide>
              <input
                type="password"
                value={editor.password}
                placeholder={editor.id ? 'Оставьте пустым, чтобы не менять' : ''}
                onChange={(event) => setEditor({ ...editor, password: event.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Набор прав" wide>
              <select value={preset} onChange={(event) => choosePreset(event.target.value)}>
                {PRESETS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="wide rights">
              {RIGHTS.map((right) => (
                <label key={right.id} className="check">
                  <input type="checkbox" checked={editor.rights.includes(right.id)} onChange={() => toggle(right.id)} />
                  <span>
                    <strong>{right.label}</strong>
                    <small>{right.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {preset !== 'custom' && sameRights(editor.rights, PRESETS.find((item) => item.id === preset)?.rights ?? []) ? (
            <p className="hint">Набор «{PRESETS.find((item) => item.id === preset)?.label}». Галочки можно поменять.</p>
          ) : null}
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setEditor(null)}>
              Отмена
            </button>
            <button type="button" className="btn primary" onClick={() => void save()}>
              Сохранить
            </button>
          </div>
        </Drawer>
      ) : null}
      {confirm ? (
        <ConfirmDialog
          text={`Удалить учётную запись «${confirm.name}»?`}
          confirmLabel="Удалить"
          onNo={() => setConfirm(null)}
          onYes={() => {
            const id = confirm.id
            setConfirm(null)
            void remove(id)
          }}
        />
      ) : null}
    </div>
  )
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} Б`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`
}
