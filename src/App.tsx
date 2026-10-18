import { useEffect, useState } from 'react'
import { debtOf, sumAmounts } from './calc'
import { longDate } from './format'
import { Dashboard } from './pages/Dashboard'
import { ExpensesPage } from './pages/Expenses'
import { FleetPage } from './pages/Fleet'
import { PaymentsPage } from './pages/Payments'
import { RepairPage } from './pages/Repair'
import { ReportsPage } from './pages/Reports'
import { TripDetail } from './pages/TripDetail'
import { TripList } from './pages/TripList'
import { useData } from './store'
import { ConfirmDialog } from './ui'

type Screen =
  | { name: 'dashboard' | 'trips' | 'expenses' | 'repair' | 'payments' | 'reports' | 'fleet' }
  | { name: 'trip'; id: string }

const NAV: { name: Exclude<Screen['name'], 'trip'>; label: string }[] = [
  { name: 'dashboard', label: 'Сводка' },
  { name: 'trips', label: 'Рейсы' },
  { name: 'expenses', label: 'Расходы' },
  { name: 'repair', label: 'Ремзона' },
  { name: 'payments', label: 'Оплаты' },
  { name: 'reports', label: 'Отчёты' },
  { name: 'fleet', label: 'Парк' },
]

const KICKER: Record<Screen['name'], string> = {
  dashboard: 'Диспетчерская',
  trips: 'Маршруты',
  trip: 'Маршруты',
  expenses: 'Затраты в пути',
  repair: 'Мастерская',
  payments: 'Деньги заказчиков',
  reports: 'Документы',
  fleet: 'Справочник',
}

export function App() {
  const { state, ready, offline, reload, resetDemo } = useData()
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const trip = screen.name === 'trip' ? state.trips.find((item) => item.id === screen.id) : undefined
  const heading =
    screen.name === 'trip'
      ? (trip?.number ?? 'Рейс')
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

  const onRoad = state.trips.filter((item) => item.status === 'loading' || item.status === 'in_transit').length
  const openRepairs = state.repairs.filter((job) => job.status !== 'done').length
  const debtCount = state.trips.filter(
    (item) => debtOf(item, sumAmounts(state.payments.filter((payment) => payment.tripId === item.id))) > 0,
  ).length
  const counts: Partial<Record<Screen['name'], number>> = {
    trips: onRoad,
    repair: openRepairs,
    payments: debtCount,
  }
  const activeNav = screen.name === 'trip' ? 'trips' : screen.name

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
          {NAV.map((item) => (
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
        </nav>
        <div className="side-foot">
          <p>Общая база на сервере. Записи видны всем, у кого открыта эта ссылка.</p>
          <button type="button" className="side-reset" onClick={() => setResetting(true)}>
            Вернуть демо-данные
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
          {ready && screen.name === 'dashboard' ? <Dashboard onOpenTrip={(id) => go({ name: 'trip', id })} /> : null}
          {ready && screen.name === 'trips' ? <TripList onOpen={(id) => go({ name: 'trip', id })} /> : null}
          {ready && screen.name === 'trip' ? <TripDetail id={screen.id} onBack={() => go({ name: 'trips' })} /> : null}
          {ready && screen.name === 'expenses' ? <ExpensesPage onOpenTrip={(id) => go({ name: 'trip', id })} /> : null}
          {ready && screen.name === 'repair' ? <RepairPage /> : null}
          {ready && screen.name === 'payments' ? <PaymentsPage onOpenTrip={(id) => go({ name: 'trip', id })} /> : null}
          {ready && screen.name === 'reports' ? <ReportsPage /> : null}
          {ready && screen.name === 'fleet' ? <FleetPage /> : null}
        </div>
      </main>
      {resetting ? (
        <ConfirmDialog
          text="Вернуть исходные демо-рейсы? Текущие записи в общей базе будут заменены у всех."
          confirmLabel="Восстановить"
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
