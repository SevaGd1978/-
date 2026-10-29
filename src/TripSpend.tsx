import { useState, type FormEvent } from 'react'
import { useAuth } from './auth'
import { expenseWithVat, parseMoney, round2, sumExpenses, tripDistanceKm, tripSalary, SALARY_PER_KM } from './calc'
import { dateRu, expenseEntryHint, expenseSkipsVehicle, kmReading, money, todayIso } from './format'
import { uid, useData } from './store'
import type { ExpenseCategory, Trip, TripExpense } from './types'
import { ConfirmDialog, Drawer, ExpenseAmount, Field, FormError, FormFooter } from './ui'

const spendCategories = [
  { id: 'fuel', label: 'Топливо' },
  { id: 'salary', label: 'Зарплата' },
  { id: 'toll', label: 'Платные дороги' },
  { id: 'other', label: 'Разное' },
] as const satisfies readonly { id: ExpenseCategory; label: string }[]

export function TripSpend({ trip }: { trip: Trip }) {
  const { state, saveExpense, deleteExpense } = useData()
  const { can } = useAuth()
  const allowed = can('expenses')
  const [editor, setEditor] = useState<{ category: ExpenseCategory; expense?: TripExpense } | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null)
  const rows = state.expenses.filter((expense) => expense.tripId === trip.id && expense.category !== 'salary')
  const shown = rows.filter((expense) => spendCategories.some((item) => item.id === expense.category))
  const distance = tripDistanceKm(trip)
  const salary = tripSalary(trip)

  return (
    <section className="trip-spend" aria-label="Расходы рейса">
      <h3>Расходы</h3>
      {spendCategories.map((item) => {
        if (item.id === 'salary') {
          return (
            <div key={item.id} className="trip-spend-cat">
              <div className="trip-spend-head">
                <span>{item.label}</span>
                <strong className="num">{salary == null ? '—' : money(salary)}</strong>
              </div>
              <p className="trip-spend-note">
                {distance == null
                  ? 'Нужны показания одометра в начале и в конце.'
                  : `${kmReading(distance)} км × ${SALARY_PER_KM} ₽`}
              </p>
            </div>
          )
        }
        const lines = shown
          .filter((expense) => expense.category === item.id)
          .sort((a, b) => b.date.localeCompare(a.date))
        const total = sumExpenses(lines)
        return (
          <div key={item.id} className="trip-spend-cat">
            <div className="trip-spend-head">
              <span>{item.label}</span>
              {allowed ? (
                <button type="button" className="text-btn" onClick={() => setEditor({ category: item.id })}>
                  Добавить
                </button>
              ) : null}
              <strong className="num">{total ? money(total) : '—'}</strong>
            </div>
            {lines.length ? (
              <ul className="trip-spend-lines">
                {lines.map((expense) => (
                  <li key={expense.id}>
                    {allowed ? (
                      <button type="button" className="text-btn" onClick={() => setEditor({ category: item.id, expense })}>
                        {dateRu(expense.date)}
                        {expense.comment ? ` · ${expense.comment}` : ''}
                      </button>
                    ) : (
                      <span>
                        {dateRu(expense.date)}
                        {expense.comment ? ` · ${expense.comment}` : ''}
                      </span>
                    )}
                    <span className="num">
                      <ExpenseAmount category={expense.category} amount={expense.amount} vat={expense.vat} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      })}
      <div className="trip-spend-head trip-spend-total">
        <span>Итого</span>
        <strong className="num">{money(round2(sumExpenses(shown) + (salary ?? 0)))}</strong>
      </div>
      {editor ? (
        <Drawer
          title={`${spendCategories.find((item) => item.id === editor.category)?.label} · ${trip.number}`}
          onClose={() => setEditor(null)}
        >
          <SpendForm
            trip={trip}
            category={editor.category}
            initial={editor.expense}
            onCancel={() => setEditor(null)}
            onSubmit={async (expense) => {
              if (await saveExpense(expense)) setEditor(null)
            }}
            onDelete={
              editor.expense
                ? () => {
                    const current = editor.expense
                    if (!current) return
                    setConfirm({
                      text: `Удалить расход ${money(expenseWithVat(current.category, current.amount, current.vat))}?`,
                      run: () => {
                        void deleteExpense(current.id).then((ok) => {
                          if (ok) setEditor(null)
                        })
                      },
                    })
                  }
                : undefined
            }
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
    </section>
  )
}

function SpendForm({
  trip,
  category,
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  trip: Trip
  category: ExpenseCategory
  initial?: TripExpense
  onSubmit: (expense: TripExpense) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? trip.date ?? todayIso())
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [vat, setVat] = useState(initial?.vat != null ? String(initial.vat) : '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [error, setError] = useState('')
  const shared = expenseSkipsVehicle(category)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseMoney(amount)
    if (!date) {
      setError('Укажите дату расхода.')
      return
    }
    if (parsed === null || parsed <= 0) {
      setError('Сумма расхода должна быть больше нуля.')
      return
    }
    const manual = vat.trim() === '' ? null : parseMoney(vat)
    if (manual === null && vat.trim() !== '') {
      setError('НДС укажите числом или оставьте поле пустым.')
      return
    }
    if (category === 'fuel' && manual != null && manual > parsed) {
      setError('НДС не может быть больше суммы топлива.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('e'),
      vehicleId: shared ? '' : (initial?.vehicleId || trip.vehicleId),
      tripId: trip.id,
      date,
      category,
      amount: parsed,
      vat: manual,
      comment: comment.trim(),
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <p className="hint wide">
        {shared
          ? 'Записывается на этот рейс, без машины.'
          : 'Записывается на этот рейс и на его машину.'}
      </p>
      <Field label="Дата">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required autoFocus />
      </Field>
      <Field label={category === 'fuel' ? 'Сумма с НДС, ₽' : 'Сумма без НДС, ₽'}>
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label="НДС, ₽">
        <input
          inputMode="decimal"
          value={vat}
          onChange={(event) => {
            setVat(event.target.value)
            setError('')
          }}
          placeholder="само"
        />
      </Field>
      <Field label="Комментарий" wide>
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Документ, кому, за что" />
      </Field>
      <p className="hint wide">{expenseEntryHint(category, parseMoney(amount), vat.trim() === '' ? null : parseMoney(vat))}</p>
      <div className="wide">
        <FormError text={error} />
        <FormFooter onCancel={onCancel} onDelete={onDelete} />
      </div>
    </form>
  )
}
