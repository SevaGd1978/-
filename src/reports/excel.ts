import type { BuiltReport, ColumnKind } from './build'
import { saveBlob } from './download'

export interface ExcelCell {
  value?: string | number
  type?: StringConstructor | NumberConstructor
  format?: string
  fontWeight?: 'bold'
  fontSize?: number
  textColor?: string
  backgroundColor?: string
  align?: 'left' | 'right'
  columnSpan?: number
  wrap?: boolean
}

const headerStyle = {
  fontWeight: 'bold' as const,
  textColor: '#ffffff',
  backgroundColor: '#1e1a17',
  wrap: true,
}

const totalStyle = {
  fontWeight: 'bold' as const,
  backgroundColor: '#eee7de',
}

function numberFormat(kind: ColumnKind) {
  if (kind === 'money') return '#,##0.00'
  if (kind === 'number') return '0.###'
  if (kind === 'figure') return '#,##0'
  return undefined
}

function dataCell(value: string | number | null, kind: ColumnKind, align: 'left' | 'right', extra?: Partial<ExcelCell>): ExcelCell {
  if (value === null || value === '') return { value: '', ...extra }
  if (typeof value === 'number') {
    return { value, type: Number, format: numberFormat(kind), align, ...extra }
  }
  return { value, type: String, align, ...extra }
}

export function reportSheet(report: BuiltReport): ExcelCell[][] {
  const span = Math.max(1, ...report.sections.map((section) => section.columns.length))
  const rows: ExcelCell[][] = [
    [{ value: report.title, type: String, fontWeight: 'bold', fontSize: 16, columnSpan: span }],
    [{ value: report.periodLabel, type: String, columnSpan: span }],
    [{ value: `Сформирован ${report.createdAt}`, type: String, columnSpan: span }],
    [{ value: report.note, type: String, wrap: true, columnSpan: span }],
    [],
  ]

  for (const section of report.sections) {
    rows.push([{ value: section.title, type: String, fontWeight: 'bold', fontSize: 13, columnSpan: span }])
    rows.push(
      section.columns.map((column) => ({
        value: column.title,
        type: String,
        align: column.align,
        ...headerStyle,
      })),
    )
    if (section.rows.length === 0) {
      rows.push([{ value: 'Нет данных за выбранный период', type: String, columnSpan: section.columns.length }])
    } else {
      for (const row of section.rows) {
        rows.push(row.map((value, index) => dataCell(value, section.columns[index].kind, section.columns[index].align)))
      }
      if (section.totals) {
        rows.push(
          section.totals.map((value, index) =>
            dataCell(value, section.columns[index].kind, index === 0 ? 'left' : section.columns[index].align, totalStyle),
          ),
        )
      }
    }
    rows.push([])
  }

  return rows
}

export function sheetOptions(report: BuiltReport) {
  const width = Math.max(1, ...report.sections.map((section) => section.columns.length))
  const columns = Array.from({ length: width }, (_, index) => ({
    width: Math.max(12, ...report.sections.map((section) => section.columns[index]?.width ?? 12)),
  }))
  const sheet = report.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Отчёт'
  return { sheet, columns, orientation: 'landscape' as const }
}

export async function downloadExcel(report: BuiltReport) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const file = await writeXlsxFile(reportSheet(report), sheetOptions(report)).toBlob()
  saveBlob(file, `${report.filename}.xlsx`)
}
