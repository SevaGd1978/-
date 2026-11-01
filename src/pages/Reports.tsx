import { useState } from 'react'
import { currentPeriod, formatPlain } from '../format'
import { buildReport, monthBounds, reportCatalog, type BuiltReport, type ReportKind } from '../reports/build'
import { uid, useData } from '../store'
import { Empty, FormError } from '../ui'

type Preset = 'month' | 'prev' | 'all' | 'custom'

interface ReadyReport extends BuiltReport {
  id: string
}

function shiftMonth(period: string, delta: number) {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function boundsFor(preset: Preset) {
  if (preset === 'all') return { from: '', to: '' }
  if (preset === 'prev') return monthBounds(shiftMonth(currentPeriod(), -1))
  return monthBounds(currentPeriod())
}

function cellText(value: string | number | null) {
  if (value === null || value === '') return ''
  if (typeof value === 'number') return formatPlain(value)
  return value
}

export function ReportsPage() {
  const { state } = useData()
  const initial = boundsFor('month')
  const [kind, setKind] = useState<ReportKind>('summary')
  const [preset, setPreset] = useState<Preset>('month')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [reports, setReports] = useState<ReadyReport[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)
  const selected = reportCatalog.find((item) => item.kind === kind) ?? reportCatalog[0]
  const active = reports.find((item) => item.id === activeId) ?? null

  function choosePreset(next: Preset) {
    setPreset(next)
    if (next === 'custom') return
    const bounds = boundsFor(next)
    setFrom(bounds.from)
    setTo(bounds.to)
  }

  function createReport() {
    if (from && to && from > to) {
      setError('Дата «с» позже даты «по».')
      return
    }
    const report: ReadyReport = { ...buildReport(state, { kind, from, to }), id: uid('rep') }
    setReports((current) => [report, ...current].slice(0, 8))
    setActiveId(report.id)
    setError('')
    setSaved('')
  }

  async function exportReport(format: 'excel' | 'pdf') {
    if (!active) return
    setBusy(format)
    setError('')
    try {
      if (format === 'excel') {
        const { downloadExcel } = await import('../reports/excel')
        await downloadExcel(active)
      } else {
        const { downloadPdf } = await import('../reports/pdf')
        await downloadPdf(active)
      }
      setSaved(format === 'excel' ? `Excel сохранён: ${active.filename}.xlsx` : `PDF сохранён: ${active.filename}.pdf`)
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : 'Не удалось выгрузить отчёт.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="section-head">
          <h2>Новый отчёт</h2>
        </div>
        <div className="chips">
          {reportCatalog.map((item) => (
            <button
              key={item.kind}
              type="button"
              className="chip"
              aria-pressed={kind === item.kind}
              onClick={() => setKind(item.kind)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="muted report-note">{selected.text}</p>
        <div className="toolbar report-toolbar">
          <select
            aria-label="Период отчёта"
            value={preset}
            onChange={(event) => choosePreset(event.target.value as Preset)}
          >
            <option value="month">Этот месяц</option>
            <option value="prev">Прошлый месяц</option>
            <option value="all">Всё время</option>
            <option value="custom">Свои даты</option>
          </select>
          <label className="field">
            <span>С</span>
            <input
              type="date"
              aria-label="Дата с"
              value={from}
              onChange={(event) => {
                setPreset('custom')
                setFrom(event.target.value)
              }}
            />
          </label>
          <label className="field">
            <span>По</span>
            <input
              type="date"
              aria-label="Дата по"
              value={to}
              onChange={(event) => {
                setPreset('custom')
                setTo(event.target.value)
              }}
            />
          </label>
          <button type="button" className="btn primary" onClick={createReport}>
            Сформировать отчёт
          </button>
        </div>
        <FormError text={error} />
      </section>

      {reports.length > 1 ? (
        <div className="chips">
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              className="chip"
              aria-pressed={report.id === activeId}
              onClick={() => setActiveId(report.id)}
            >
              {report.title} · {report.periodLabel}
            </button>
          ))}
        </div>
      ) : null}

      {!active ? (
        <Empty title="Отчёт ещё не сформирован" text="Выберите вид и период, затем нажмите «Сформировать отчёт»." />
      ) : (
        <section className="card">
          <div className="section-head">
            <div className="report-meta">
              <h2>{active.title}</h2>
              <p className="muted">
                {active.periodLabel} · сформирован {active.createdAt}
              </p>
            </div>
            <div className="report-actions">
              <button type="button" className="btn ghost" disabled={busy !== null} onClick={() => exportReport('excel')}>
                {busy === 'excel' ? 'Готовим Excel…' : 'Скачать Excel'}
              </button>
              <button type="button" className="btn primary" disabled={busy !== null} onClick={() => exportReport('pdf')}>
                {busy === 'pdf' ? 'Готовим PDF…' : 'Скачать PDF'}
              </button>
            </div>
          </div>
          {saved ? (
            <p className="saved-note" role="status">
              {saved}
            </p>
          ) : null}
          <p className="muted">{active.note}</p>
          {active.sections.map((section) => (
            <div key={section.title} className="report-section">
              <h3>
                {section.title}
                <span className="muted"> · {section.rows.length}</span>
              </h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {section.columns.map((column) => (
                        <th key={column.title} className={column.align === 'right' ? 'num' : undefined}>
                          {column.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length === 0 ? (
                      <tr>
                        <td colSpan={section.columns.length}>Нет данных за выбранный период</td>
                      </tr>
                    ) : (
                      section.rows.map((row, rowIndex) => (
                        <tr key={`${section.title}-${rowIndex}`}>
                          {row.map((value, columnIndex) => (
                            <td
                              key={`${section.title}-${rowIndex}-${columnIndex}`}
                              className={section.columns[columnIndex].align === 'right' ? 'num' : undefined}
                            >
                              {cellText(value)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {section.totals ? (
                    <tfoot>
                      <tr>
                        {section.totals.map((value, index) => (
                          <td key={`${section.title}-total-${index}`} className={index === 0 ? undefined : 'num'}>
                            <strong>{cellText(value)}</strong>
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
