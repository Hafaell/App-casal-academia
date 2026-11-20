import { describe, expect, it } from 'vitest'
import { localHour } from './dates'
import { dayPeriod, monthReport, pickYearPhotos, yearSummary, type ReportResult } from './report'
import type { TogetherCheckin } from './together'

const GYM = { lat: -20.6711, lng: -40.4997 }
const TZ = 'America/Sao_Paulo'

let n = 0
/** `time` é o horário UTC; em Brasília são 3 horas a menos. */
const c = (user_id: string, day: string, time = '13:00', pos: { lat: number; lng: number } | null = GYM): TogetherCheckin => ({
  id: `c${++n}`,
  user_id,
  day,
  lat: pos?.lat ?? null,
  lng: pos?.lng ?? null,
  created_at: `${day}T${time}:00Z`,
})

const r = (week_start: string, user_id: string, met: boolean, fine = 0): ReportResult => ({
  week_start,
  user_id,
  met,
  used_joker: false,
  owes: !met,
  fine_amount: met ? 0 : fine,
})

describe('hora local', () => {
  it('usa o fuso do grupo e a meia-noite é 0', () => {
    expect(localHour('2026-11-18T15:00:00Z', TZ)).toBe(12)
    expect(localHour('2026-11-18T03:00:00Z', TZ)).toBe(0)
    expect(dayPeriod(0)).toBe('madrugada')
    expect(dayPeriod(7)).toBe('manha')
    expect(dayPeriod(12)).toBe('tarde')
    expect(dayPeriod(19)).toBe('noite')
  })
})

describe('relatório do mês', () => {
  const checkins = [
    c('a', '2026-11-02', '10:00'), // segunda, 7h em Brasília
    c('b', '2026-11-02', '10:30'), // juntos
    c('a', '2026-11-03', '22:00'), // terça, 19h
    c('a', '2026-11-09', '10:00'), // segunda
    c('b', '2026-11-10', '22:00', null), // terça, sem GPS
    c('a', '2026-10-30', '10:00'), // outubro: fica de fora
  ]
  const results = [
    r('2026-11-02', 'a', true),
    r('2026-11-02', 'b', true),
    r('2026-11-09', 'a', true),
    r('2026-11-09', 'b', false, 30),
    r('2026-10-26', 'b', false, 50), // outubro
  ]

  it('soma treinos, semanas, multas e treinos juntos só do mês', () => {
    const rep = monthReport({ month: '2026-11', memberIds: ['a', 'b'], checkins, results, timeZone: TZ })
    expect(rep.checkins).toBe(5)
    expect(rep.people).toEqual([
      { userId: 'a', checkins: 3, weeksMet: 2, weeks: 2, fines: 0 },
      { userId: 'b', checkins: 2, weeksMet: 1, weeks: 2, fines: 30 },
    ])
    expect(rep.weeks).toBe(2)
    expect(rep.weeksAllMet).toBe(1)
    expect(rep.together).toBe(1)
    expect(rep.fines).toBe(30)
  })

  it('acha o dia da semana e o período em que mais treinam', () => {
    const rep = monthReport({ month: '2026-11-01', memberIds: ['a', 'b'], checkins, results, timeZone: TZ })
    expect(rep.bestWeekday).toEqual({ dow: 1, count: 3 })
    expect(rep.bestPeriod).toEqual({ period: 'manha', count: 3 })
  })

  it('mês vazio não quebra', () => {
    const rep = monthReport({ month: '2026-12', memberIds: ['a'], checkins, results, timeZone: TZ })
    expect(rep).toMatchObject({ checkins: 0, weeks: 0, together: 0, fines: 0, bestWeekday: null, bestPeriod: null })
  })
})

describe('ano', () => {
  it('resume o ano', () => {
    const checkins = [c('a', '2026-03-02'), c('b', '2026-03-02'), c('a', '2025-12-29')]
    const results = [r('2026-03-02', 'a', true), r('2026-03-02', 'b', true), r('2026-03-09', 'a', false, 10), r('2026-03-09', 'b', true)]
    expect(yearSummary('2026', checkins, results)).toEqual({ checkins: 2, together: 1, weeksAllMet: 1 })
  })

  it('espalha as fotos pelos meses e prefere treinos a dois', () => {
    const jan = [c('a', '2026-01-05'), c('a', '2026-01-12'), c('a', '2026-01-19'), c('b', '2026-01-19')]
    const fev = [c('a', '2026-02-02')]
    const picked = pickYearPhotos('2026', [...jan, ...fev, c('a', '2025-12-01')], 3)
    expect(picked).toHaveLength(3)
    expect(picked.map((p) => p.day.slice(0, 7))).toContain('2026-02')
    // As duas de janeiro são as do treino a dois (dia 19).
    expect(picked.filter((p) => p.day.startsWith('2026-01')).map((p) => p.day)).toEqual(['2026-01-19', '2026-01-19'])
    expect(picked.map((p) => p.created_at)).toEqual([...picked.map((p) => p.created_at)].sort())
  })

  it('usa todas as fotos quando há menos que o máximo', () => {
    const list = [c('a', '2026-05-04'), c('a', '2026-07-06')]
    expect(pickYearPhotos('2026', list)).toHaveLength(2)
    expect(pickYearPhotos('2026', [])).toEqual([])
  })
})
