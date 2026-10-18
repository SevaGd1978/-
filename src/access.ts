export const RIGHTS = [
  { id: 'trips', label: 'Рейсы', hint: 'Создавать и менять рейсы' },
  { id: 'expenses', label: 'Расходы', hint: 'Записывать затраты в пути' },
  { id: 'repairs', label: 'Ремзона', hint: 'Вести заявки мастерской' },
  { id: 'payments', label: 'Оплаты', hint: 'Принимать оплату за рейсы' },
  { id: 'fleet', label: 'Парк', hint: 'Менять машины и водителей' },
  { id: 'reports', label: 'Отчёты', hint: 'Смотреть и выгружать отчёты' },
  { id: 'users', label: 'Учётные записи', hint: 'Создавать людей и выдавать права' },
  { id: 'reset', label: 'Сброс демо', hint: 'Вернуть учебные рейсы' },
] as const

export type Right = (typeof RIGHTS)[number]['id']

export const ALL_RIGHTS: Right[] = RIGHTS.map((item) => item.id)

export const PRESETS: { id: string; label: string; rights: Right[] }[] = [
  { id: 'admin', label: 'Администратор', rights: ALL_RIGHTS },
  { id: 'dispatcher', label: 'Диспетчер', rights: ['trips', 'expenses', 'repairs', 'fleet', 'reports'] },
  { id: 'accountant', label: 'Бухгалтер', rights: ['payments', 'reports'] },
  { id: 'viewer', label: 'Только просмотр', rights: ['reports'] },
  { id: 'custom', label: 'Свой набор', rights: [] },
]

export interface PublicUser {
  id: string
  username: string
  name: string
  rights: Right[]
}

export function isRight(value: string): value is Right {
  return ALL_RIGHTS.some((item) => item === value)
}

export function rightLabel(id: Right) {
  return RIGHTS.find((item) => item.id === id)?.label ?? id
}

export function sameRights(left: Right[], right: Right[]) {
  return left.length === right.length && left.every((item) => right.includes(item))
}

export function presetFor(rights: Right[]) {
  return PRESETS.find((item) => item.id !== 'custom' && sameRights(item.rights, rights))?.id ?? 'custom'
}
