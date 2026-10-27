import { useMemo, useState } from 'react'
import { expenseWithVat, inPeriod, sumExpenses, VAT_PERCENT } from '../calc'
import {
  currentPeriod,
  dateRu,
  expenseCategories,
  expenseCategoryLabel,
  expenseSkipsVehicle,
  money,
  periodTitle,
  sharedExpenseCategories,
  type SharedExpenseCategory,
} from '../format'
import { ExpenseForm, SharedExpenseForm } from '../forms'
import { useAuth } from '../auth'
import { useData } from '../store'
import type { ExpenseCategory, TripExpense } from '../types'
import { ConfirmDialog, Drawer, Empty, ExpenseAmount } from '../ui'

export function ExpensesPage() {
  const { state, saveExpense, deleteExpense } = useData()
  const { can } = useAuth()
  const allowed = can('expenses')
  const [period, setPeriod] = useState(currentPeriod())
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all')
  const [vehicleId, setVehicleId] = useState('all')
  const [editor, setEditor] = useState<
    { mode: 'vehicle'; expense?: TripExpense } | { mode: 'shared'; category: SharedExpenseCategory; expense?: TripExpense } | null
  >(null)
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null)

  const periods = useMemo(() => {
    const keys = new Set<string>([currentPeriod()])
    for (const expense of state.expenses) keys.add(expense.date.slice(0, 7))
    return [...keys].sort().reverse()
  }, [state.expenses])

  const vehicles = [...state.vehicles].sort((a, b) => a.plate.localeCompare(b.plate, 'ru'))

  const rows = [...state.expenses]
    .filter((expense) => inPeriod(expense.date, period))
    .filter((expense) => (category === 'all' ? true : expense.category === category))
    .filter((expense) =>
      vehicleId === 'all' ? true : vehicleId === 'none' ? expense.vehicleId === '' : expense.vehicleId === vehicleId,
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  function openExpense(expense: TripExpense) {
    if (expenseSkipsVehicle(expense.category)) {
      setEditor({ mode: 'shared', category: expense.category as SharedExpenseCategory, expense })
      return
    }
    setEditor({ mode: 'vehicle', expense })
  }

  return (
    <div className="stack">
      <section className="kpi-grid" aria-label="Расходы без машины">
        {sharedExpenseCategories.map((item) => {
          const matched = state.expenses.filter((expense) => inPeriod(expense.date, period) && expense.category === item)
          const card = (
            <>
              <span>{expenseCategoryLabel[item]}</span>
              <strong className="num">{money(sumExpenses(matched))}</strong>
              <em>Дата, категория, сумма и НДС</em>
            </>
          )
          return allowed ? (
            <button key={item} type="button" className="kpi cost-card" onClick={() => setEditor({ mode: 'shared', category: item })}>
              {card}
            </button>
          ) : (
            <article key={item} className="kpi">
              {card}
            </article>
          )
        })}
      </section>
      <div className="toolbar">
        <select aria-label="Период" value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="all">Всё время</option>
          {periods.map((item) => (
            <option key={item} value={item}>
              {periodTitle(item)}
            </option>
          ))}
        </select>
        <select aria-label="Категория" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory | 'all')}>
          <option value="all">Все статьи</option>
          {expenseCategories.map((item) => (
            <option key={item} value={item}>
              {expenseCategoryLabel[item]}
            </option>
          ))}
        </select>
        <select aria-label="Машина" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
          <option value="all">Все машины</option>
          <option value="none">Без машины</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate} · {vehicle.model}
            </option>
          ))}
        </select>
        {allowed ? (
          <button type="button" className="btn primary" onClick={() => setEditor({ mode: 'vehicle' })}>
            Добавить расход
          </button>
        ) : null}
      </div>
      {allowed ? null : <p className="hint">Просмотр. Менять расходы может тот, у кого есть это право.</p>}
      <p className="muted">
        Итого по фильтру: {money(sumExpenses(rows))}. Пустое поле НДС считает {VAT_PERCENT}% (на топливе ноль), вписанная сумма
        записывается как есть. Карточки
        «Платон», «Ремзона» и «Платные дороги» спрашивают дату, категорию и сумму, без машины. Топливо, суточные и погрузка — кнопка
        «Добавить расход», там нужна машина.
      </p>
      <section className="card">
        {rows.length === 0 ? (
          <Empty title="Расходов нет" text="Топливо и суточные — на машину. Платон и платные дороги — без машины." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Машина</th>
                  <th>Статья</th>
                  <th>Комментарий</th>
                  <th className="num">Сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((expense) => {
                  const vehicle = state.vehicles.find((item) => item.id === expense.vehicleId)
                  return (
                    <tr key={expense.id}>
                      <td>{dateRu(expense.date)}</td>
                      <td>{expense.vehicleId ? (vehicle ? vehicle.plate : '—') : 'Без машины'}</td>
                      <td>{expenseCategoryLabel[expense.category]}</td>
                      <td>{expense.comment || '—'}</td>
                      <td className="num">
                        <ExpenseAmount category={expense.category} amount={expense.amount} vat={expense.vat} />
                      </td>
                      <td className="row-actions">
                        {allowed ? (
                          <>
                            <button type="button" className="text-btn" onClick={() => openExpense(expense)}>
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="text-btn danger-text"
                              onClick={() =>
                                setConfirm({
                                  text: `Удалить расход ${money(expenseWithVat(expense.category, expense.amount, expense.vat))}?`,
                                  run: () => void deleteExpense(expense.id),
                                })
                              }
                            >
                              Удалить
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editor ? (
        <Drawer
          title={
            editor.expense ? 'Изменить расход' : editor.mode === 'shared' ? expenseCategoryLabel[editor.category] : 'Расход по машине'
          }
          onClose={() => setEditor(null)}
        >
          {editor.mode === 'shared' ? (
            <SharedExpenseForm
              category={editor.category}
              initial={editor.expense}
              onCancel={() => setEditor(null)}
              onSubmit={async (expense) => {
                if (await saveExpense(expense)) setEditor(null)
              }}
            />
          ) : (
            <ExpenseForm
              initial={editor.expense}
              onCancel={() => setEditor(null)}
              onSubmit={async (expense) => {
                if (await saveExpense(expense)) setEditor(null)
              }}
            />
          )}
        </Drawer>
      ) : null}
      {confirm ? (
        <ConfirmDialog
          text={confirm.text}
          confirmLabel="Удалить"
          onNo={() => setConfirm(null)}
          onYes={() => {
            confirm.run()
            setConfirm(null)
          }}
        />
      ) : null}
    </div>
  )
}
