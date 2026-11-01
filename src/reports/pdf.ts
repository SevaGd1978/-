import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatPlain } from '../format'
import type { BuiltReport, ReportSection } from './build'
import { saveBlob } from './download'

let cachedFonts: { regular: string; bold: string } | null = null

function bytesToBase64(bytes: Uint8Array) {
  const chunk = 8192
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

async function fontBase64(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Не удалось загрузить шрифт для PDF.')
  return bytesToBase64(new Uint8Array(await response.arrayBuffer()))
}

async function browserFonts() {
  if (cachedFonts) return cachedFonts
  const [regular, bold] = await Promise.all([
    fontBase64('/fonts/Roboto-Regular.ttf'),
    fontBase64('/fonts/Roboto-Bold.ttf'),
  ])
  cachedFonts = { regular, bold }
  return cachedFonts
}

function cellText(value: string | number | null) {
  if (value === null || value === '') return ''
  if (typeof value === 'number') return formatPlain(value)
  return value
}

function drawSection(doc: jsPDF, section: ReportSection, startY: number) {
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(29, 25, 21)
  doc.text(section.title, 10, startY)

  const body =
    section.rows.length === 0
      ? [[{ content: 'Нет данных за выбранный период', colSpan: section.columns.length }]]
      : section.rows.map((row) => row.map(cellText))
  const foot = section.totals ? [section.totals.map(cellText)] : undefined

  autoTable(doc, {
    startY: startY + 3,
    margin: { top: 14, right: 10, bottom: 14, left: 10 },
    head: [section.columns.map((column) => column.title)],
    body,
    foot,
    showHead: 'everyPage',
    styles: {
      font: 'Roboto',
      fontStyle: 'normal',
      fontSize: 7.5,
      textColor: [29, 25, 21],
      lineColor: [228, 216, 201],
      lineWidth: 0.1,
      cellPadding: 1.4,
      overflow: 'linebreak',
    },
    headStyles: {
      font: 'Roboto',
      fontStyle: 'bold',
      fillColor: [30, 26, 23],
      textColor: 255,
    },
    footStyles: {
      font: 'Roboto',
      fontStyle: 'bold',
      fillColor: [238, 231, 222],
      textColor: [29, 25, 21],
    },
    alternateRowStyles: { fillColor: [247, 243, 236] },
    columnStyles: Object.fromEntries(
      section.columns.map((column, index) => [index, { halign: column.align }]),
    ),
  })

  const drawn = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  return (drawn.lastAutoTable?.finalY ?? startY) + 10
}

export async function renderPdf(
  report: BuiltReport,
  fonts?: { regular: Uint8Array; bold: Uint8Array },
) {
  const encoded = fonts
    ? { regular: bytesToBase64(fonts.regular), bold: bytesToBase64(fonts.bold) }
    : await browserFonts()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.addFileToVFS('Roboto-Regular.ttf', encoded.regular)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', encoded.bold)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(16)
  doc.text(report.title, 10, 14)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(10)
  doc.text(report.periodLabel, 10, 21)
  doc.text(`Сформирован ${report.createdAt}`, 10, 27)
  const note = doc.splitTextToSize(report.note, 277)
  doc.text(note, 10, 33)

  let cursor = 33 + note.length * 5 + 4
  for (const section of report.sections) {
    if (cursor > 180) {
      doc.addPage()
      cursor = 16
    }
    cursor = drawSection(doc, section, cursor)
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(111, 101, 92)
    const height = doc.internal.pageSize.getHeight()
    const width = doc.internal.pageSize.getWidth()
    doc.text('Путевой', 10, height - 6)
    doc.text(`${page} / ${pages}`, width - 10, height - 6, { align: 'right' })
  }

  return new Uint8Array(doc.output('arraybuffer'))
}

export async function downloadPdf(report: BuiltReport) {
  const bytes = await renderPdf(report)
  saveBlob(new Blob([bytes], { type: 'application/pdf' }), `${report.filename}.pdf`)
}
