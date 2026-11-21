import { describe, expect, it } from 'vitest'
import { challengeProgress, type ChallengeCheckin } from './challenges'
import { exceptionsLeft, exceptionsUsedInMonth } from './exceptionLimit'
import { formatBrDate, parseBrDate } from './dates'

const GYM = { lat: -20.6711, lng: -40.4997 }
let n = 0
const c = (user_id: string, day: string, kind: string | null = null, time = '13:00'): ChallengeCheckin => ({
  id: `c${++n}`,
  user_id,
  day,
  kind,
  lat: GYM.lat,
  lng: GYM.lng,
  created_at: `${day}T${time}:00Z`,
})

describe('desafio do mês', () => {
  const list = [
    c('a', '2026-11-02', 'cardio'),
    c('b', '2026-11-02', 'cardio'), // juntos
    c('a', '2026-11-03', 'musculacao'),
    c('b', '2026-11-05', 'cardio'),
    c('a', '2026-10-30', 'cardio'), // outubro: fora
  ]

  it('conta só o mês e o tipo do desafio', () => {
    expect(challengeProgress({ month: '2026-11-01', kind: 'cardio', target: 3 }, list)).toEqual({ done: 3, target: 3, complete: true })
    expect(challengeProgress({ month: '2026-11-01', kind: 'musculacao', target: 2 }, list)).toMatchObject({ done: 1, complete: false })
    expect(challengeProgress({ month: '2026-11-01', kind: 'total', target: 10 }, list).done).toBe(4)
  })

  it('"juntos" conta dias de treino a dois', () => {
    expect(challengeProgress({ month: '2026-11-01', kind: 'juntos', target: 1 }, list)).toEqual({ done: 1, target: 1, complete: true })
  })
})

describe('limite de exceções', () => {
  const ex = [
    { user_id: 'a', day: '2026-11-02' },
    { user_id: 'a', day: '2026-11-20' },
    { user_id: 'a', day: '2026-12-01' },
    { user_id: 'b', day: '2026-11-03' },
  ]
  it('conta por pessoa e pelo mês do dia justificado', () => {
    expect(exceptionsUsedInMonth(ex, 'a', '2026-11-15')).toBe(2)
    expect(exceptionsLeft(ex, 'a', '2026-11-15', 4)).toBe(2)
    expect(exceptionsLeft(ex, 'a', '2026-11-15', 1)).toBe(0)
    expect(exceptionsLeft(ex, 'b', '2026-12-10', 4)).toBe(4)
  })
})

describe('data digitada', () => {
  it('lê DD/MM/AAAA e recusa data que não existe', () => {
    expect(parseBrDate('21/11/2026')).toBe('2026-11-21')
    expect(parseBrDate(' 1/2/2026 ')).toBe('2026-02-01')
    expect(parseBrDate('31/02/2026')).toBeNull()
    expect(parseBrDate('2026-11-21')).toBeNull()
    expect(formatBrDate('2026-11-21')).toBe('21/11/2026')
  })
})
