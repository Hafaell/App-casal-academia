/** Reações nas fotos e tipo de treino (opcional). As mesmas listas valem no banco (check constraints). */

export const REACTION_EMOJIS = ['💪', '🔥', '👏', '😍'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export const CHECKIN_KINDS = {
  musculacao: 'Musculação',
  cardio: 'Cardio',
  aula: 'Aula',
  outro: 'Outro',
} as const
export type CheckinKind = keyof typeof CHECKIN_KINDS

export interface ReactionLike {
  id: string
  user_id: string
  emoji: string
}

/** Quantas reações de cada emoji e qual é a minha (se houver). */
export function summarizeReactions(list: ReactionLike[], userId: string) {
  const counts = new Map<string, number>()
  let mine: ReactionLike | null = null
  for (const r of list) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1)
    if (r.user_id === userId) mine = r
  }
  return { counts, mine }
}

export type ReactionAction =
  | { type: 'add'; emoji: ReactionEmoji }
  | { type: 'change'; id: string; emoji: ReactionEmoji }
  | { type: 'remove'; id: string }

/** Tocar no mesmo emoji tira a reação; em outro, troca; sem reação, cria. */
export function nextReactionAction(mine: ReactionLike | null, emoji: ReactionEmoji): ReactionAction {
  if (!mine) return { type: 'add', emoji }
  if (mine.emoji === emoji) return { type: 'remove', id: mine.id }
  return { type: 'change', id: mine.id, emoji }
}
