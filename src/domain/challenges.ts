/**
 * Desafios do mês: um objetivo coletivo do grupo no mês (ex.: 8 treinos de cardio somados).
 * Não mexe em meta nem multa; cumprido, dá um giro extra na roleta de prêmios.
 * Mesma conta de public.challenge_progress no banco (que é quem libera o giro).
 */
import { monthKey } from './dates'
import { findTogether, type TogetherCheckin } from './together'

export type ChallengeKind = 'total' | 'musculacao' | 'cardio' | 'aula' | 'juntos'

export const CHALLENGE_KIND_LABEL: Record<ChallengeKind, string> = {
  total: 'Treinos somados',
  musculacao: 'Treinos de musculação',
  cardio: 'Treinos de cardio',
  aula: 'Aulas',
  juntos: 'Treinos juntos',
}

/** Sugestões prontas para criar o desafio com um toque. */
export const CHALLENGE_PRESETS: { title: string; kind: ChallengeKind; target: number }[] = [
  { title: 'Mês do cardio', kind: 'cardio', target: 8 },
  { title: 'Mês da dupla', kind: 'juntos', target: 6 },
  { title: 'Mês cheio', kind: 'total', target: 30 },
  { title: 'Mês das aulas', kind: 'aula', target: 4 },
]

export interface ChallengeLike {
  month: string
  kind: ChallengeKind
  target: number
}

export interface ChallengeCheckin extends TogetherCheckin {
  kind: string | null
}

export function challengeProgress(ch: ChallengeLike, checkins: ChallengeCheckin[]): { done: number; target: number; complete: boolean } {
  const month = monthKey(ch.month)
  const inMonth = checkins.filter((c) => monthKey(c.day) === month)
  let done: number
  if (ch.kind === 'juntos') done = findTogether(inMonth).days.length
  else if (ch.kind === 'total') done = inMonth.length
  else done = inMonth.filter((c) => c.kind === ch.kind).length
  return { done, target: ch.target, complete: done >= ch.target }
}
