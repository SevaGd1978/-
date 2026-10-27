import { useMemo, useState } from 'react'
import { inPeriod, repairCost, sumAmounts } from '../calc'
import { currentPeriod, dateRu, money, periodTitle, repairKindLabel, repairStatusLabel, repairTone } from '../format'
import { RepairForm } from '../forms'
import { useAuth } from '../auth'
import { useData } from '../store'
import type { RepairJob, RepairStatus } from '../types'
import { Badge, ConfirmDialog, Drawer, Empty } from '../ui'

export function RepairPage() {
  const { state, saveRepair, deleteRepair } = useData()
  const { can } = useAuth()
  const allowed = can('repairs')
  const [period, setPeriod] = useState(currentPeriod())
  const [vehicleId, setVehicleId] = useState('all')
  const [status, setStatus] = useState<RepairStatus | 'all'>('all')
  const [editor, setEditor] = useState<RepairJob | 'new' | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null)

  const periods = useMemo(() => {
    const keys = new Set<string>([currentPeriod()])
    for (const job of state.repairs) keys.add(job.date.slice(0, 7))
    return [...keys].sort().reverse()
  }, [state.repairs])

  const rows = [...state.repairs]
    .filter((job) => inPeriod(job.date, period))
    .filter((job) => (vehicleId === 'all' ? true : vehicleId === 'none' ? job.vehicleId === '' : job.vehicleId === vehicleId))
    .filter((job) => (status === 'all' ? true : job.status === status))
    .sort((a, b) => b.date.localeCompare(a.date))
  const total = sumAmounts(rows.map((job) => ({ amount: repairCost(job) })))
  const openJobs = state.repairs.filter((job) => job.status !== 'done').length

  return (
    <div className="stack">
      <section className="kpi-grid kpi-grid-compact">
        <article className="kpi">
          <span>Заявки в фильтре</span>
          <strong className="num">{rows.length}</strong>
          <em>Сейчас не готово: {openJobs}</em>
        </article>
        <article className="kpi">
          <span>Сумма ремзоны</span>
          <strong className="num">{money(total)}</strong>
          <em>Запчасти плюс работа</em>
        </article>
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
        <select aria-label="Машина" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
          <option value="all">Все машины</option>
          <option value="none">Без машины</option>
          {state.vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate}
            </option>
          ))}
        </select>
        <select aria-label="Статус заявки" value={status} onChange={(event) => setStatus(event.target.value as RepairStatus | 'all')}>
          <option value="all">Все статусы</option>
          <option value="queued">В очереди</option>
          <option value="in_progress">В работе</option>
          <option value="done">Готово</option>
        </select>
        {allowed ? (
          <button type="button" className="btn primary" onClick={() => setEditor('new')}>
            Новая заявка
          </button>
        ) : null}
      </div>
      {allowed ? (
        <p className="hint">Запчасти можно записать без машины. Остальные заявки остаются на автомобиле.</p>
      ) : (
        <p className="hint">Просмотр. Менять ремзону может тот, у кого есть это право.</p>
      )}
      <section className="card">
        {rows.length === 0 ? (
          <Empty title="Заявок нет" text="Ремонт, ТО и шины ведутся по машине. Запчасти можно записать без машины." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Машина</th>
                  <th>Работы</th>
                  <th>Статус</th>
                  <th className="num">Итого</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => {
                  const vehicle = state.vehicles.find((item) => item.id === job.vehicleId)
                  return (
                    <tr key={job.id}>
                      <td>{dateRu(job.date)}</td>
                      <td>{job.vehicleId ? (vehicle ? vehicle.plate : '—') : 'Без машины'}</td>
                      <td>
                        {repairKindLabel[job.kind]} · {job.description}
                        <small className="muted">
                          Запчасти {money(job.partsCost)} · работа {money(job.laborCost)}
                          {job.odometer != null ? ` · ${job.odometer.toLocaleString('ru-RU')} км` : ''}
                        </small>
                      </td>
                      <td>
                        <Badge tone={repairTone(job.status)}>{repairStatusLabel[job.status]}</Badge>
                      </td>
                      <td className="num">{money(repairCost(job))}</td>
                      <td className="row-actions">
                        {allowed ? (
                          <>
                            <button type="button" className="text-btn" onClick={() => setEditor(job)}>
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="text-btn danger-text"
                              onClick={() =>
                                setConfirm({
                                  text: `Удалить заявку «${job.description}»?`,
                                  run: () => void deleteRepair(job.id),
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
        <Drawer title={editor === 'new' ? 'Заявка в ремзону' : 'Изменить заявку'} onClose={() => setEditor(null)}>
          <RepairForm
            initial={editor === 'new' ? undefined : editor}
            onCancel={() => setEditor(null)}
            onSubmit={async (job) => {
              if (await saveRepair(job)) setEditor(null)
            }}
            onDelete={
              editor === 'new'
                ? undefined
                : () => {
                    const current = editor
                    setConfirm({
                      text: `Удалить заявку «${current.description}»?`,
                      run: () => {
                        void deleteRepair(current.id).then((ok) => {
                          if (ok) setEditor(null)
                        })
                      },
                    })
                  }
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
    </div>
  )
}
