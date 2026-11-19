/** Нормализация госномера для сравнения: без пробелов, латиница → кириллица. */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: 'А',
  B: 'В',
  E: 'Е',
  K: 'К',
  M: 'М',
  H: 'Н',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  Y: 'У',
  X: 'Х',
}

export function normalizePlateKey(plate: string) {
  return plate
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[ABEKMHOPCTYX]/g, (letter) => LATIN_TO_CYRILLIC[letter] ?? letter)
}

export function platesMatch(a: string, b: string) {
  return normalizePlateKey(a) === normalizePlateKey(b)
}
