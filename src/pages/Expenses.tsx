import { useMemo, useState } from 'react'
import { expenseWithVat, inPeriod, sumExpenses, VAT_PERCENT } from '../calc'
import {
  currentPeriod,
  dateRu,
  expenseCategories,
  expenseCategoryLabel,
  money,
  periodTitle,
} from '../format'
import { ExpenseForm } from '../forms'
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
  const [editor, setEditor] = useState<TripExpense | 'new' | null>(null)
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

  return (
    <div className="stack">
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
          <button type="button" className="btn primary" onClick={() => setEditor('new')}>
            Добавить расход
          </button>
        ) : null}
      </div>
      {allowed ? null : <p className="hint">Просмотр. Менять расходы может тот, у кого есть это право.</p>}
      <p className="muted">
        Итого по фильтру: {money(sumExpenses(rows))}. Кроме топлива, к сумме добавлен НДС {VAT_PERCENT}%. Топливо,
        суточные и погрузка записываются на машину. Платон и платные дороги идут отдельно, без машины, и остаются, если
        рейс удалить.
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
                        <ExpenseAmount category={expense.category} amount={expense.amount} />
                      </td>
                      <td className="row-actions">
                        {allowed ? (
                          <>
                            <button type="button" className="text-btn" onClick={() => setEditor(expense)}>
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="text-btn danger-text"
                              onClick={() =>
                                setConfirm({
                                  text: `Удалить расход ${money(expenseWithVat(expense.category, expense.amount))}?`,
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
        <Drawer title={editor === 'new' ? 'Расход' : 'Изменить расход'} onClose={() => setEditor(null)}>
          <ExpenseForm
            initial={editor === 'new' ? undefined : editor}
            onCancel={() => setEditor(null)}
            onSubmit={async (expense) => {
              if (await saveExpense(expense)) setEditor(null)
            }}
          />
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
