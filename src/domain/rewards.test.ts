import { describe, expect, it } from 'vitest'
import { rewardMilestones, weeksToNextReward } from './rewards'
import { awaitingReview, reviewState } from './exceptionReview'
import type { WeekOutcome } from './streak'

const w = (weekStart: string, userId: string, met: boolean, usedJoker = false): WeekOutcome => ({ weekStart, userId, met, usedJoker })
const both = (weekStart: string, a: boolean, b: boolean, jokerB = false) => [w(weekStart, 'a', a), w(weekStart, 'b', b, jokerB)]

describe('roleta de prêmios', () => {
  it('dá um giro a cada 2 semanas seguidas em que os dois batem', () => {
    const m = rewardMilestones([
      ...both('2026-10-05', true, true),
      ...both('2026-10-12', true, true), // 2 seguidas: giro
      ...both('2026-10-19', true, true),
      ...both('2026-10-26', true, true), // 4: giro
      ...both('2026-11-02', true, true),
    ])
    expect(m).toEqual(['2026-10-12', '2026-10-26'])
  })

  it('falha sem coringa zera; coringa não soma nem zera', () => {
    const m = rewardMilestones([
      ...both('2026-10-05', true, true),
      ...both('2026-10-12', true, false), // zera
      ...both('2026-10-19', true, true),
      ...both('2026-10-26', true, false, true), // coringa: segura em 1
      ...both('2026-11-02', true, true), // 2: giro
    ])
    expect(m).toEqual(['2026-11-02'])
  })

  it('a ordem de entrada não importa e conta quanto falta', () => {
    expect(rewardMilestones([...both('2026-10-12', true, true), ...both('2026-10-05', true, true)])).toEqual(['2026-10-12'])
    expect(weeksToNextReward(0)).toBe(2)
    expect(weeksToNextReward(1)).toBe(1)
    expect(weeksToNextReward(2)).toBe(2)
  })
})

describe('resposta à exceção', () => {
  const TZ = 'America/Sao_Paulo'
  // Marcada em 20/11 às 22h em Brasília (21/11 01h UTC).
  const e = { user_id: 'a', created_at: '2026-11-21T01:00:00Z', reviewed_at: null }

  it('o parceiro responde até as 23h59 do dia em que foi marcada', () => {
    expect(reviewState(e, 'b', '2026-11-20', TZ)).toBe('open')
    expect(reviewState(e, 'b', '2026-11-21', TZ)).toBe('expired')
    expect(awaitingReview(e, '2026-11-20', TZ)).toBe(true)
    expect(awaitingReview(e, '2026-11-21', TZ)).toBe(false)
  })

  it('a própria pessoa não responde; aprovada não volta a abrir', () => {
    expect(reviewState(e, 'a', '2026-11-20', TZ)).toBe('mine')
    expect(reviewState({ ...e, reviewed_at: '2026-11-21T01:10:00Z' }, 'b', '2026-11-20', TZ)).toBe('approved')
  })
})
