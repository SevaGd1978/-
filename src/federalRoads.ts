// Учетные номера из перечня автомобильных дорог общего пользования федерального значения.
// Постановление Правительства РФ от 17.11.2010 № 928.
const FEDERAL_ROADS = new Set<string>([
  'А-103','А-104','А-105','А-106','А-107','А-108','А-109','А-110','А-111','А-112','А-113','А-114','А-118','А-119','А-120','А-121','А-122','А-123','А-130','А-131','А-132','А-133','А-134','А-135','А-136','А-137','А-142','А-146','А-147','А-148','А-149','А-151','А-153','А-154','А-155','А-156','А-157','А-158','А-159','А-160','А-161','А-162','А-163','А-164','А-165','А-167','А-180','А-181','А-212','А-215','А-216','А-217','А-229','А-240','А-258','А-260','А-270','А-280','А-289','А-290','А-291','А-295','А-298','А-300','А-305','А-310','А-320','А-321','А-322','А-331','А-332','А-333','А-340','А-350','А-360','А-361','А-370','А-371','А-375','А-376','А-381','А-384','А-385','А-391','А-392','А-393','А-401',
  'М-1','М-2','М-3','М-4','М-5','М-7','М-8','М-9','М-10','М-11','М-12',
  'Р-21','Р-22','Р-23','Р-56','Р-92','Р-119','Р-120','Р-132','Р-150','Р-158','Р-176','Р-177','Р-178','Р-193','Р-207','Р-208','Р-215','Р-216','Р-217','Р-228','Р-229','Р-239','Р-240','Р-241','Р-242','Р-243','Р-254','Р-255','Р-256','Р-257','Р-258','Р-260','Р-280','Р-297','Р-298','Р-351','Р-354','Р-402','Р-404','Р-504','Р-600',
])

const LATIN: Record<string, string> = {
  A: 'А', a: 'а', B: 'В', E: 'Е', e: 'е', H: 'Н', K: 'К', k: 'к', M: 'М', m: 'м',
  O: 'О', o: 'о', P: 'Р', p: 'р', C: 'С', c: 'с', T: 'Т', X: 'Х', x: 'х', Y: 'У', y: 'у', R: 'Р', r: 'р',
}

export function isFederalRef(value: string | null | undefined) {
  return federalCodes(value).length > 0
}

export function federalCodes(value: string | null | undefined) {
  if (!value) return []
  const text = [...value].map((char) => LATIN[char] ?? char).join('').toUpperCase()
  const found: string[] = []
  for (const token of text.split(/[^0-9A-ZА-ЯЁ-]+/)) {
    const code = canon(token)
    if (code && FEDERAL_ROADS.has(code) && !found.includes(code)) found.push(code)
  }
  return found
}

function canon(token: string) {
  const match = token.match(/^([МАР])-?0*(\d{1,4})$/)
  if (!match) return null
  const number = Number(match[2])
  if (!number) return null
  return `${match[1]}-${number}`
}

export function federalMeters(steps: { distance?: number; ref?: string | null }[]) {
  let meters = 0
  for (const step of steps) {
    if (!isFederalRef(step.ref) || typeof step.distance !== 'number' || step.distance <= 0) continue
    meters += step.distance
  }
  return meters
}

export function federalKilometers(steps: { distance?: number; ref?: string | null }[]) {
  return Math.round(federalMeters(steps) / 100) / 10
}
