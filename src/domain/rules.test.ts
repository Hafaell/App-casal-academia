import { describe, expect, it } from 'vitest'
import { countCheckins, reducingExceptionDays, weekProgress } from './rules'

const rules = { weeklyGoal: 4, sundayCounts: false }
const monday = '2026-10-05'

describe('meta da semana', () => {
  it('exceção em dia útil reduz a meta em 1', () => {
    expect(reducingExceptionDays(monday, ['2026-10-06', '2026-10-07'], [])).toBe(2)
  })

  it('exceção em dia que a pessoa treinou não reduz', () => {
    expect(reducingExceptionDays(monday, ['2026-10-05'], ['2026-10-05'])).toBe(0)
  })

  it('exceção no sábado ou fora da semana não reduz', () => {
    expect(reducingExceptionDays(monday, ['2026-10-10', '2026-10-13'], [])).toBe(0)
  })

  it('domingo não conta, sábado conta', () => {
    expect(countCheckins(monday, ['2026-10-10', '2026-10-11'], rules)).toBe(1)
    expect(countCheckins(monday, ['2026-10-10', '2026-10-11'], { ...rules, sundayCounts: true })).toBe(2)
  })

  it('dois treinos no mesmo dia contam como 1', () => {
    expect(countCheckins(monday, ['2026-10-05', '2026-10-05'], rules)).toBe(1)
  })
})

describe('progresso da semana', () => {
  const base = { rules, monday, checkinDays: [] as string[], exceptionDays: [] as string[], usedJoker: false }

  it('na segunda sem treino: 6 dias pela frente, tranquilo', () => {
    const p = weekProgress({ ...base, today: '2026-10-05' })
    expect(p).toMatchObject({ goal: 4, done: 0, daysLeft: 6, status: 'on_track' })
  })

  it('na quarta sem treino: 4 dias para 4 treinos, no limite', () => {
    const p = weekProgress({ ...base, today: '2026-10-07' })
    expect(p).toMatchObject({ daysLeft: 4, status: 'at_risk' })
  })

  it('na quinta sem treino: não dá mais', () => {
    const p = weekProgress({ ...base, today: '2026-10-08' })
    expect(p.status).toBe('missed')
  })

  it('treinou hoje: hoje não conta como dia restante', () => {
    const p = weekProgress({ ...base, today: '2026-10-05', checkinDays: ['2026-10-05'] })
    expect(p).toMatchObject({ done: 1, daysLeft: 5, trainedToday: true })
  })

  it('coringa salva a semana', () => {
    const p = weekProgress({ ...base, today: '2026-10-09', usedJoker: true })
    expect(p.status).toBe('joker')
  })

  it('meta batida', () => {
    const p = weekProgress({
      ...base,
      today: '2026-10-08',
      checkinDays: ['2026-10-05', '2026-10-06'],
      exceptionDays: ['2026-10-07', '2026-10-08'],
    })
    expect(p).toMatchObject({ goal: 2, done: 2, status: 'met' })
  })

  it('semana antes do início do grupo', () => {
    const p = weekProgress({ ...base, today: '2026-10-08', startsOn: '2026-10-12' })
    expect(p.status).toBe('not_started')
  })
})
