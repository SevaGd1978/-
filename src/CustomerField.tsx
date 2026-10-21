import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { customerTripsLabel, suggestCustomers, type CustomerEntry } from './customers'

export function CustomerField({
  label,
  value,
  onChange,
  catalog,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  catalog: CustomerEntry[]
}) {
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const matched = useMemo(() => (open ? suggestCustomers(value, catalog) : []), [open, value, catalog])
  const suggestions = matched.length || !value.trim() ? matched : catalog.slice(0, 12)
  const index = suggestions.length ? Math.min(active, suggestions.length - 1) : 0

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index, suggestions])

  function pick(label: string) {
    onChange(label)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true)
      event.preventDefault()
      return
    }
    if (!open) return
    if (event.key === 'Escape') {
      setOpen(false)
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (!suggestions.length) return
    if (event.key === 'ArrowDown') {
      setActive(Math.min(index + 1, suggestions.length - 1))
      event.preventDefault()
    } else if (event.key === 'ArrowUp') {
      setActive(Math.max(index - 1, 0))
      event.preventDefault()
    } else if (event.key === 'Enter' && suggestCustomers(value, catalog).length) {
      event.preventDefault()
      pick(suggestions[index].label)
    }
  }

  const showList = open && catalog.length > 0
  const note =
    value.trim() && !matched.length ? 'Нет в справочнике — имя сохранится после записи рейса' : ''

  return (
    <div className="field">
      <span>{label}</span>
      <div className="city-field">
        <input
          value={value}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls={listId}
          autoComplete="off"
          placeholder="Начните вводить имя"
          onChange={(event) => {
            onChange(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {showList ? (
          <ul className="city-list" id={listId} role="listbox" ref={listRef}>
            {note ? <li className="city-empty">{note}</li> : null}
            {suggestions.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  role="option"
                  aria-selected={suggestions[index]?.label === item.label}
                  className={suggestions[index]?.label === item.label ? 'is-active' : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(suggestions.indexOf(item))}
                  onClick={() => pick(item.label)}
                >
                  <strong>{item.label}</strong>
                  {item.count > 0 ? <span>{customerTripsLabel(item.count)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
