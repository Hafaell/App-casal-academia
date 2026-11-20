/**
 * "Nossa história": números do mês e escolha das fotos da colagem do ano.
 * Só lê o que já aconteceu (check-ins e semanas fechadas). Não decide nada que valha dinheiro.
 */
import { isoDow, localHour, monthKey } from './dates'
import { findTogether, type TogetherCheckin } from './together'

export interface ReportResult {
  week_start: string
  user_id: string
  met: boolean
  used_joker: boolean
  owes: boolean
  fine_amount: number
}

export interface PersonMonth {
  userId: string
  checkins: number
  weeksMet: number
  weeks: number
  fines: number
}

export type DayPeriod = 'madrugada' | 'manha' | 'tarde' | 'noite'

export const DAY_PERIOD_LABEL: Record<DayPeriod, string> = {
  madrugada: 'de madrugada',
  manha: 'de manhã',
  tarde: 'à tarde',
  noite: 'à noite',
}

export interface MonthReport {
  /** 'AAAA-MM' */
  month: string
  people: PersonMonth[]
  checkins: number
  /** Semanas fechadas do mês (pela segunda-feira). */
  weeks: number
  /** Semanas em que todo mundo bateu a meta. */
  weeksAllMet: number
  together: number
  fines: number
  /** Dia da semana com mais treinos (1 = segunda ... 7 = domingo). */
  bestWeekday: { dow: number; count: number } | null
  bestPeriod: { period: DayPeriod; count: number } | null
}

export function dayPeriod(hour: number): DayPeriod {
  if (hour < 5) return 'madrugada'
  if (hour < 12) return 'manha'
  if (hour < 18) return 'tarde'
  return 'noite'
}

/** O mais frequente; empate fica com o primeiro que apareceu na ordem dada. */
function top<K>(counts: Map<K, number>, order: K[]): { key: K; count: number } | null {
  let best: { key: K; count: number } | null = null
  for (const key of order) {
    const count = counts.get(key) ?? 0
    if (count > 0 && (!best || count > best.count)) best = { key, count }
  }
  return best
}

export function monthReport(input: {
  month: string
  memberIds: string[]
  checkins: TogetherCheckin[]
  results: ReportResult[]
  timeZone: string
}): MonthReport {
  const month = input.month.slice(0, 7)
  const checkins = input.checkins.filter((c) => monthKey(c.day) === month)
  const results = input.results.filter((r) => monthKey(r.week_start) === month)

  const people = input.memberIds.map((userId) => {
    const mine = results.filter((r) => r.user_id === userId)
    return {
      userId,
      checkins: checkins.filter((c) => c.user_id === userId).length,
      weeksMet: mine.filter((r) => r.met).length,
      weeks: mine.length,
      fines: mine.filter((r) => r.owes).reduce((s, r) => s + r.fine_amount, 0),
    }
  })

  const byWeek = new Map<string, ReportResult[]>()
  for (const r of results) byWeek.set(r.week_start, [...(byWeek.get(r.week_start) ?? []), r])

  const dows = new Map<number, number>()
  const periods = new Map<DayPeriod, number>()
  for (const c of checkins) {
    const dow = isoDow(c.day)
    dows.set(dow, (dows.get(dow) ?? 0) + 1)
    const p = dayPeriod(localHour(c.created_at, input.timeZone))
    periods.set(p, (periods.get(p) ?? 0) + 1)
  }
  const bestDow = top(dows, [1, 2, 3, 4, 5, 6, 7])
  const bestPeriod = top(periods, ['manha', 'tarde', 'noite', 'madrugada'] as DayPeriod[])

  return {
    month,
    people,
    checkins: checkins.length,
    weeks: byWeek.size,
    weeksAllMet: [...byWeek.values()].filter((list) => list.every((r) => r.met)).length,
    together: findTogether(checkins).days.length,
    fines: people.reduce((s, p) => s + p.fines, 0),
    bestWeekday: bestDow && { dow: bestDow.key, count: bestDow.count },
    bestPeriod: bestPeriod && { period: bestPeriod.key, count: bestPeriod.count },
  }
}

export interface YearSummary {
  checkins: number
  together: number
  weeksAllMet: number
}

export function yearSummary(year: string, checkins: TogetherCheckin[], results: ReportResult[]): YearSummary {
  const inYear = checkins.filter((c) => c.day.startsWith(year))
  const byWeek = new Map<string, ReportResult[]>()
  for (const r of results.filter((x) => x.week_start.startsWith(year))) byWeek.set(r.week_start, [...(byWeek.get(r.week_start) ?? []), r])
  return {
    checkins: inYear.length,
    together: findTogether(inYear).days.length,
    weeksAllMet: [...byWeek.values()].filter((list) => list.every((r) => r.met)).length,
  }
}

/**
 * Fotos da colagem do ano: espalha pelos meses (uma de cada mês por rodada) e prefere
 * os treinos a dois. Devolve em ordem de data.
 */
export function pickYearPhotos<T extends TogetherCheckin>(year: string, checkins: T[], max = 12): T[] {
  const inYear = checkins.filter((c) => c.day.startsWith(year))
  const togetherIds = findTogether(inYear).checkinIds
  const byMonth = new Map<string, T[]>()
  for (const c of [...inYear].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    byMonth.set(monthKey(c.day), [...(byMonth.get(monthKey(c.day)) ?? []), c])
  }
  // Em cada mês: primeiro os treinos a dois, depois os outros, do meio do mês para as pontas.
  const queues = [...byMonth.keys()].sort().map((m) => {
    const list = byMonth.get(m)!
    const mid = (list.length - 1) / 2
    const spread = [...list].sort((a, b) => Math.abs(list.indexOf(a) - mid) - Math.abs(list.indexOf(b) - mid))
    return [...spread.filter((c) => togetherIds.has(c.id)), ...spread.filter((c) => !togetherIds.has(c.id))]
  })
  const picked: T[] = []
  for (let round = 0; picked.length < max && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      if (picked.length >= max) break
      if (q[round]) picked.push(q[round])
    }
  }
  return picked.sort((a, b) => a.created_at.localeCompare(b.created_at))
}
