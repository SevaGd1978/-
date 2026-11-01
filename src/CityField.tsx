import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cityChoice, suggestCities, type CityPoint } from './cities'
import { loadCityList } from './cityCatalog'

export function CityField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [cities, setCities] = useState<CityPoint[]>([])
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const suggestions = useMemo(() => {
    if (!open) return []
    const matched = suggestCities(value, cities)
    if (matched.length || !value.trim()) return matched
    return suggestCities('', cities)
  }, [open, value, cities])
  const approximate = open && Boolean(value.trim()) && suggestCities(value, cities).length === 0
  const index = suggestions.length ? Math.min(active, suggestions.length - 1) : 0

  useEffect(() => {
    let stop = false
    loadCityList()
      .then((list) => {
        if (!stop) setCities(list)
      })
      .catch(() => {
        if (!stop) setFailed(true)
      })
    return () => {
      stop = true
    }
  }, [])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index, suggestions])

  function pick(city: CityPoint) {
    onChange(cityChoice(city, cities))
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
    if (event.key === 'ArrowDown') {
      setActive(Math.min(index + 1, suggestions.length - 1))
      event.preventDefault()
      return
    }
    if (event.key === 'ArrowUp') {
      setActive(Math.max(index - 1, 0))
      event.preventDefault()
      return
    }
    if (event.key === 'Enter' && suggestCities(value, cities).length) {
      event.preventDefault()
      pick(suggestions[index])
    }
  }

  const showList = open && !failed
  const note = !cities.length
    ? 'Загрузка списка городов…'
    : approximate
      ? 'Нет точного совпадения — выберите город или оставьте свой текст'
      : ''

  return (
    <div className="field">
      <span>{label}</span>
      <div className="city-field">
        <input
          value={value}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls={listId}
          autoComplete="off"
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
            {suggestions.length ? (
              suggestions.map((city, item) => (
                <li key={`${city.name}\n${city.region}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={item === index}
                    className={item === index ? 'is-active' : undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(item)}
                    onClick={() => pick(city)}
                  >
                    <strong>{city.name}</strong>
                    <span>{city.region}</span>
                  </button>
                </li>
              ))
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
