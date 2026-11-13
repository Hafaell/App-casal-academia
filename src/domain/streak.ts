export interface WeekOutcome {
  weekStart: string
  userId: string
  met: boolean
  usedJoker: boolean
}

export interface Streak {
  current: number
  best: number
}

/**
 * Semanas seguidas batendo a meta. Uma semana salva pelo coringa não quebra
 * a sequência, mas também não soma.
 */
export function personStreak(outcomes: WeekOutcome[]): Streak {
  const sorted = [...outcomes].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  let current = 0
  let best = 0
  for (const o of sorted) {
    if (o.met) {
      current++
      best = Math.max(best, current)
    } else if (!o.usedJoker) {
      current = 0
    }
  }
  return { current, best }
}

/** Sequência do grupo: a semana só soma se todo mundo bateu a meta. */
export function groupStreak(outcomes: WeekOutcome[]): Streak {
  const byWeek = new Map<string, WeekOutcome[]>()
  for (const o of outcomes) {
    const list = byWeek.get(o.weekStart) ?? []
    list.push(o)
    byWeek.set(o.weekStart, list)
  }
  const weeks = [...byWeek.keys()].sort()
  let current = 0
  let best = 0
  for (const w of weeks) {
    const list = byWeek.get(w)!
    if (list.every((o) => o.met)) {
      current++
      best = Math.max(best, current)
    } else if (!list.every((o) => o.met || o.usedJoker)) {
      current = 0
    }
  }
  return { current, best }
}
