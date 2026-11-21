/**
 * Roleta de prêmios: a cada REWARD_EVERY_WEEKS semanas seguidas em que todo mundo bate a meta,
 * o grupo ganha um giro. Mesma regra de public.spin_reward no banco (que é quem decide de verdade):
 * semana em que todos bateram soma; alguém falhou sem coringa zera; coringa não soma nem zera.
 */
import type { WeekOutcome } from './streak'

/** Igual a public.reward_every_weeks() no banco. */
export const REWARD_EVERY_WEEKS = 2

/** Semanas (segunda-feira) em que o grupo completou um marco e ganhou um giro, em ordem. */
export function rewardMilestones(outcomes: WeekOutcome[], every = REWARD_EVERY_WEEKS): string[] {
  const byWeek = new Map<string, WeekOutcome[]>()
  for (const o of outcomes) byWeek.set(o.weekStart, [...(byWeek.get(o.weekStart) ?? []), o])
  const milestones: string[] = []
  let streak = 0
  for (const week of [...byWeek.keys()].sort()) {
    const list = byWeek.get(week)!
    if (list.every((o) => o.met)) {
      streak++
      if (streak % every === 0) milestones.push(week)
    } else if (!list.every((o) => o.met || o.usedJoker)) {
      streak = 0
    }
  }
  return milestones
}

/** Quantas semanas faltam para o próximo giro, a partir da sequência atual. */
export function weeksToNextReward(currentStreak: number, every = REWARD_EVERY_WEEKS): number {
  return every - (currentStreak % every)
}
