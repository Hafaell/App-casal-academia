import { describe, expect, it } from 'vitest'
import { groupStreak, personStreak, type WeekOutcome } from './streak'

const w = (weekStart: string, userId: string, met: boolean, usedJoker = false): WeekOutcome => ({
  weekStart,
  userId,
  met,
  usedJoker,
})

describe('sequência', () => {
  it('conta semanas seguidas e guarda a melhor', () => {
    const s = personStreak([
      w('2026-09-07', 'a', true),
      w('2026-09-14', 'a', true),
      w('2026-09-21', 'a', true),
      w('2026-09-28', 'a', false),
      w('2026-10-05', 'a', true),
    ])
    expect(s).toEqual({ current: 1, best: 3 })
  })

  it('coringa não quebra nem soma', () => {
    const s = personStreak([w('2026-09-07', 'a', true), w('2026-09-14', 'a', false, true), w('2026-09-21', 'a', true)])
    expect(s).toEqual({ current: 2, best: 2 })
  })

  it('a ordem de entrada não importa', () => {
    const s = personStreak([w('2026-09-21', 'a', true), w('2026-09-07', 'a', false), w('2026-09-14', 'a', true)])
    expect(s.current).toBe(2)
  })

  it('casal só soma quando os dois batem', () => {
    const s = groupStreak([
      w('2026-09-07', 'a', true),
      w('2026-09-07', 'b', true),
      w('2026-09-14', 'a', true),
      w('2026-09-14', 'b', false),
      w('2026-09-21', 'a', true),
      w('2026-09-21', 'b', true),
    ])
    expect(s).toEqual({ current: 1, best: 1 })
  })
})
