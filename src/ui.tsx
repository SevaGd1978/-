import { useEffect, type ReactNode } from 'react'
import { expenseVat, expenseWithVat } from './calc'
import { money } from './format'

export function ExpenseAmount({ category, amount, vat }: { category: string; amount: number; vat?: number | null }) {
  const tax = expenseVat(category, amount, vat)
  return (
    <>
      {money(expenseWithVat(category, amount, vat))}
      {tax > 0 ? <small className="muted">НДС {money(tax)}</small> : null}
    </>
  )
}

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
    </div>
  )
}

export function Field({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}

export function ConfirmDialog({
  text,
  confirmLabel,
  onYes,
  onNo,
}: {
  text: string
  confirmLabel: string
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div className="overlay confirm-layer" onMouseDown={onNo}>
      <div
        className="confirm"
        role="dialog"
        aria-modal="true"
        aria-label="Подтверждение"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p>{text}</p>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onNo}>
            Отмена
          </button>
          <button type="button" className="btn danger" onClick={onYes}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function FormError({ text }: { text: string }) {
  if (!text) return null
  return (
    <p className="form-error" role="alert">
      {text}
    </p>
  )
}

export function FormFooter({
  onCancel,
  onDelete,
  submitLabel = 'Сохранить',
}: {
  onCancel: () => void
  onDelete?: () => void
  submitLabel?: string
}) {
  return (
    <div className="form-actions">
      <div>{onDelete ? <button type="button" className="btn danger" onClick={onDelete}>Удалить</button> : null}</div>
      <div className="form-actions-right">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn primary">
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
