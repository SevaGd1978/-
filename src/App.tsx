import { useEffect, useState } from 'react'
import { debtOf, sumAmounts } from './calc'
import { longDate } from './format'
import { Dashboard } from './pages/Dashboard'
import { ExpensesPage } from './pages/Expenses'
import { FinesPage } from './pages/Fines'
import { FleetPage } from './pages/Fleet'
import { PaymentsPage } from './pages/Payments'
import { RepairPage } from './pages/Repair'
import { ReportsPage } from './pages/Reports'
import { TripDetail } from './pages/TripDetail'
import { LoginPage } from './pages/Login'
import { TripList } from './pages/TripList'
import { AccountsPage } from './pages/Accounts'
import { useAuth } from './auth'
import { useData } from './store'
import { looksLikeDemoSeed } from './demoSeed'
import { ConfirmDialog } from './ui'

type Screen =
  | { name: 'dashboard' | 'trips' | 'expenses' | 'repair' | 'payments' | 'reports' | 'fines' | 'fleet' | 'accounts' }
  | { name: 'trip'; id: string }

const NAV: { name: Exclude<Screen['name'], 'trip'>; label: string }[] = [
  { name: 'dashboard', label: 'Сводка' },
  { name: 'trips', label: 'Рейсы' },
  { name: 'expenses', label: 'Расходы' },
  { name: 'repair', label: 'Ремзона' },
  { name: 'payments', label: 'Оплаты' },
  { name: 'fines', label: 'Штрафы' },
  { name: 'reports', label: 'Отчёты' },
  { name: 'fleet', label: 'Парк' },
]

const KICKER: Record<Screen['name'], string> = {
  dashboard: 'Диспетчерская',
  trips: 'Маршруты',
  trip: 'Маршруты',
  expenses: 'Затраты',
  repair: 'Мастерская',
  payments: 'Деньги заказчиков',
  fines: 'Госавтоинспекция',
  reports: 'Документы',
  fleet: 'Справочник',
  accounts: 'Люди',
}

export function App() {
  const { user, ready: authReady, needsSetup, can, logout } = useAuth()
  const { state, ready, offline, reload, resetDemo } = useData()
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (screen.name === 'reports' && !can('reports')) setScreen({ name: 'dashboard' })
    if (screen.name === 'accounts' && !can('users')) setScreen({ name: 'dashboard' })
  }, [screen.name, can])

  const trip = screen.name === 'trip' ? state.trips.find((item) => item.id === screen.id) : undefined
  const heading =
    screen.name === 'trip'
      ? (trip?.number ?? 'Рейс')
      : screen.name === 'accounts'
        ? 'Учётные записи'
        : (NAV.find((item) => item.name === screen.name)?.label ?? 'Путевой')
  const kicker = KICKER[screen.name]

  useEffect(() => {
    document.title = `${heading} — Путевой`
    window.scrollTo(0, 0)
  }, [heading, screen])

  function go(next: Screen) {
    setScreen(next)
    setMenuOpen(false)
  }

  const openRepairs = state.repairs.filter((job) => job.status !== 'done').length
  const debtCount = state.trips.filter(
    (item) => debtOf(item, sumAmounts(state.payments.filter((payment) => payment.tripId === item.id))) > 0,
  ).length
  const demoSeed = ready && looksLikeDemoSeed(state)
  // В меню «Рейсы» — всего рейсов в базе (раньше был только «на линии», из‑за нуля казалось, что рейсов нет).
  const counts: Partial<Record<Screen['name'], number>> = {
    trips: state.trips.length,
    repair: openRepairs,
    payments: debtCount,
  }
  const activeNav = screen.name === 'trip' ? 'trips' : screen.name
  const nav = NAV.filter((item) => (item.name === 'reports' ? can('reports') : true))

  if (!authReady) {
    return (
      <div className="gate">
        <p className="hint">Проверяем вход…</p>
      </div>
    )
  }
  if (!user) return <LoginPage setup={needsSetup} />

  return (
    <div className="shell">
      <aside className={menuOpen ? 'side open' : 'side'}>
        <div className="brand">
          <span className="brand-mark">П</span>
          <div>
            <strong>Путевой</strong>
            <em>диспетчерская</em>
          </div>
        </div>
        <nav className="nav" aria-label="Разделы">
          {nav.map((item) => (
            <button
              key={item.name}
              type="button"
              aria-current={activeNav === item.name ? 'page' : undefined}
              onClick={() => go({ name: item.name })}
            >
              {item.label}
              {counts[item.name] ? <span className="count">{counts[item.name]}</span> : null}
            </button>
          ))}
          {can('users') ? (
            <button
              type="button"
              aria-current={activeNav === 'accounts' ? 'page' : undefined}
              onClick={() => go({ name: 'accounts' })}
            >
              Учётные записи
            </button>
          ) : null}
        </nav>
        <div className="side-foot">
          <p className="who">
            <strong>{user.name}</strong>
            <span>{user.username}</span>
          </p>
          <p>Общая база на сервере. Записи видны всем, кто вошёл.</p>
          {can('reset') ? (
            <button type="button" className="side-reset" onClick={() => setResetting(true)}>
              Вернуть демо-данные
            </button>
          ) : null}
          <button type="button" className="side-reset" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </aside>
      {menuOpen ? (
        <button type="button" className="scrim" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />
      ) : null}
      <main className="main">
        <div className="content" data-page={screen.name}>
          <header className="top">
            <div className="top-title">
              <button type="button" className="menu-btn" onClick={() => setMenuOpen(true)}>
                Меню
              </button>
              <div>
                <p className="eyebrow">{kicker}</p>
                <h1>{heading}</h1>
              </div>
            </div>
            <time dateTime={new Date().toISOString()}>{longDate(new Date())}</time>
          </header>
          {!ready ? (
            <section className="card">
              <div className="empty">
                <strong>{offline ? 'Нет связи с базой' : 'Открываем общую базу'}</strong>
                <span>
                  {offline
                    ? 'Сервер не ответил. Проверьте, что приложение запущено, и повторите.'
                    : 'Загружаем рейсы, расходы и оплаты.'}
                </span>
              </div>
              {offline ? (
                <button type="button" className="btn" onClick={() => void reload()}>
                  Повторить
                </button>
              ) : null}
            </section>
          ) : null}
          {offline && ready ? <p className="net-banner">Нет связи с общей базой. Показаны последние полученные данные.</p> : null}
          {demoSeed ? (
            <p className="warn-banner" role="status">
              Сейчас в базе учебные демо-рейсы (Р-1034…Р-1041). Если пропали рабочие записи — скорее всего нажали
              «Вернуть демо-данные» или база на сервере пересоздалась. Восстановите из резервной копии Amvera /{' '}
              <code>/api/backup</code>.
            </p>
          ) : null}
          {ready && screen.name === 'dashboard' ? (
            <Dashboard onOpenTrip={(id) => go({ name: 'trip', id })} onOpenTrips={() => go({ name: 'trips' })} />
          ) : null}
          {ready && screen.name === 'trips' ? <TripList onOpen={(id) => go({ name: 'trip', id })} /> : null}
          {ready && screen.name === 'trip' ? (
            <TripDetail id={screen.id} onBack={() => go({ name: 'trips' })} onOpen={(id) => go({ name: 'trip', id })} />
          ) : null}
          {ready && screen.name === 'expenses' ? <ExpensesPage /> : null}
          {ready && screen.name === 'repair' ? <RepairPage /> : null}
          {ready && screen.name === 'payments' ? <PaymentsPage onOpenTrip={(id) => go({ name: 'trip', id })} /> : null}
          {ready && screen.name === 'fines' ? <FinesPage /> : null}
          {ready && screen.name === 'reports' ? <ReportsPage /> : null}
          {ready && screen.name === 'fleet' ? <FleetPage /> : null}
          {ready && screen.name === 'accounts' ? <AccountsPage /> : null}
        </div>
      </main>
      {resetting ? (
        <ConfirmDialog
          text="Это сотрёт все рабочие рейсы, оплаты и расходы у всех пользователей и подставит учебные демо-данные. Сначала скачайте резервную копию (/api/backup), если данные ещё нужны."
          confirmLabel="Стереть и вернуть демо"
          confirmPhrase="СБРОС"
          onNo={() => setResetting(false)}
          onYes={() => {
            resetDemo()
            setResetting(false)
            go({ name: 'dashboard' })
          }}
        />
      ) : null}
    </div>
  )
}
