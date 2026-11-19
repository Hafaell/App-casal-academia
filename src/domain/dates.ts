/**
 * Datas do app no formato 'AAAA-MM-DD', sempre no fuso do grupo.
 * Toda a aritmética é feita em UTC para não sofrer com fuso do aparelho.
 */
export type ISODate = string

const WEEKDAYS_SHORT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const WEEKDAYS_LONG = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function toUTC(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

function fromUTC(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

/** Data de hoje no fuso informado. */
export function localToday(timeZone: string, now: Date = new Date()): ISODate {
  return localDate(now, timeZone)
}

/** Converte um instante (ex.: created_at) na data local do fuso. */
export function localDate(instant: Date | string, timeZone: string): ISODate {
  const d = typeof instant === 'string' ? new Date(instant) : instant
  // Monta pelas partes (ano, mês, dia) em vez de confiar na ordem do 'en-CA':
  // o motor do app nativo (Hermes) não garante o mesmo formato do navegador.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month').padStart(2, '0')}-${get('day').padStart(2, '0')}`
}

export function localTime(instant: Date | string, timeZone: string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d)
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = toUTC(d)
  date.setUTCDate(date.getUTCDate() + n)
  return fromUTC(date)
}

/** 1 = segunda ... 7 = domingo (igual ao isodow do Postgres). */
export function isoDow(d: ISODate): number {
  const js = toUTC(d).getUTCDay()
  return js === 0 ? 7 : js
}

export function mondayOf(d: ISODate): ISODate {
  return addDays(d, 1 - isoDow(d))
}

export function weekDays(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000)
}

export function monthKey(d: ISODate): string {
  return d.slice(0, 7)
}

export function firstOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`
}

export function addMonths(d: ISODate, n: number): ISODate {
  const date = toUTC(firstOfMonth(d))
  date.setUTCMonth(date.getUTCMonth() + n)
  return fromUTC(date)
}

export function daysInMonth(d: ISODate): number {
  const date = toUTC(firstOfMonth(d))
  date.setUTCMonth(date.getUTCMonth() + 1)
  date.setUTCDate(0)
  return date.getUTCDate()
}

export function weekdayShort(d: ISODate): string {
  return WEEKDAYS_SHORT[isoDow(d) - 1]
}

export function weekdayLong(d: ISODate): string {
  return WEEKDAYS_LONG[isoDow(d) - 1]
}

/** "13/11" */
export function dayMonth(d: ISODate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

export function monthName(d: ISODate): string {
  return MONTHS[Number(d.slice(5, 7)) - 1]
}

/** "Novembro de 2026" */
export function monthLabel(d: ISODate): string {
  const m = monthName(d)
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${d.slice(0, 4)}`
}

/** "05/10 a 11/10" */
export function weekRange(monday: ISODate): string {
  return `${dayMonth(monday)} a ${dayMonth(addDays(monday, 6))}`
}

/** Segunda-feira em que alguém que entra hoje passa a ter meta. */
export function firstMondayFrom(d: ISODate): ISODate {
  return isoDow(d) === 1 ? d : addDays(mondayOf(d), 7)
}
