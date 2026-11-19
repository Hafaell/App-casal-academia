import { describe, expect, it } from 'vitest'
import { nextReactionAction, summarizeReactions } from './reactions'

const list = [
  { id: 'r1', user_id: 'a', emoji: '🔥' },
  { id: 'r2', user_id: 'b', emoji: '🔥' },
  { id: 'r3', user_id: 'c', emoji: '💪' },
]

describe('reações', () => {
  it('conta por emoji e acha a minha', () => {
    const s = summarizeReactions(list, 'b')
    expect(s.counts.get('🔥')).toBe(2)
    expect(s.counts.get('💪')).toBe(1)
    expect(s.counts.get('👏')).toBeUndefined()
    expect(s.mine?.id).toBe('r2')
    expect(summarizeReactions(list, 'z').mine).toBeNull()
  })

  it('cria, troca ou tira conforme o toque', () => {
    expect(nextReactionAction(null, '👏')).toEqual({ type: 'add', emoji: '👏' })
    expect(nextReactionAction(list[0], '🔥')).toEqual({ type: 'remove', id: 'r1' })
    expect(nextReactionAction(list[0], '😍')).toEqual({ type: 'change', id: 'r1', emoji: '😍' })
  })
})
