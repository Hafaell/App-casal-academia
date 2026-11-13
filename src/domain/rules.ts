import { addDays, isoDow, type ISODate } from './dates'

export interface GroupRules {
  weeklyGoal: number
  sundayCounts: boolean
}

/** Domingo é folga, a menos que o grupo diga o contrário. */
export function dayCounts(day: ISODate, rules: GroupRules): boolean {
  return isoDow(day) < 7 || rules.sundayCounts
}

/**
 * Dias justificados que reduzem a meta: só de segunda a sexta e só se a
 * pessoa não treinou naquele dia. Mesma regra da função close_week no banco.
 */
export function reducingExceptionDays(
  monday: ISODate,
  exceptionDays: ISODate[],
  checkinDays: ISODate[],
): number {
  const friday = addDays(monday, 4)
  const trained = new Set(checkinDays)
  return new Set(exceptionDays.filter((d) => d >= monday && d <= friday && !trained.has(d))).size
}

export function countCheckins(monday: ISODate, checkinDays: ISODate[], rules: GroupRules): number {
  const sunday = addDays(monday, 6)
  return new Set(checkinDays.filter((d) => d >= monday && d <= sunday && dayCounts(d, rules))).size
}

export type WeekStatus = 'met' | 'on_track' | 'at_risk' | 'missed' | 'joker' | 'not_started'

export interface WeekProgress {
  goal: number
  exceptionDays: number
  done: number
  missing: number
  /** Dias da semana em que ainda dá para fazer check-in (inclui hoje se ainda não treinou). */
  daysLeft: number
  trainedToday: boolean
  status: WeekStatus
}

export function weekProgress(input: {
  rules: GroupRules
  monday: ISODate
  today: ISODate
  checkinDays: ISODate[]
  exceptionDays: ISODate[]
  usedJoker: boolean
  /** Primeira segunda-feira em que a meta vale para a pessoa. */
  startsOn?: ISODate
}): WeekProgress {
  const { rules, monday, today, checkinDays, exceptionDays, usedJoker, startsOn } = input
  const exceptions = reducingExceptionDays(monday, exceptionDays, checkinDays)
  const goal = Math.max(0, rules.weeklyGoal - exceptions)
  const done = countCheckins(monday, checkinDays, rules)
  const missing = Math.max(0, goal - done)
  const trainedToday = checkinDays.includes(today)

  const lastDay = addDays(monday, rules.sundayCounts ? 6 : 5)
  let daysLeft = 0
  for (let d = today; d <= lastDay; d = addDays(d, 1)) {
    if (d < monday) continue
    if (d === today && trainedToday) continue
    // Dia justificado não é um dia em que se espera treino.
    if (exceptionDays.includes(d)) continue
    daysLeft++
  }

  let status: WeekStatus
  if (startsOn && monday < startsOn) status = 'not_started'
  else if (done >= goal) status = 'met'
  else if (usedJoker) status = 'joker'
  else if (missing > daysLeft) status = 'missed'
  else if (missing === daysLeft) status = 'at_risk'
  else status = 'on_track'

  return { goal, exceptionDays: exceptions, done, missing, daysLeft, trainedToday, status }
}

export const EXCEPTION_REASONS = {
  doenca: 'Doença',
  viagem: 'Viagem',
  lesao: 'Lesão',
  menstruacao: 'Menstruação',
} as const

export type ExceptionReason = keyof typeof EXCEPTION_REASONS

export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
