import { describe, expect, it } from 'vitest'
import { findTogether, type TogetherCheckin } from './together'

const GYM = { lat: -20.6711, lng: -40.4997 }

const c = (id: string, user_id: string, day: string, time: string, pos: { lat: number; lng: number } | null = GYM): TogetherCheckin => ({
  id,
  user_id,
  day,
  lat: pos?.lat ?? null,
  lng: pos?.lng ?? null,
  created_at: `${day}T${time}:00Z`,
})

describe('treino a dois', () => {
  it('conta o dia em que os dois treinaram no mesmo lugar e perto da mesma hora', () => {
    const r = findTogether([
      c('a1', 'a', '2026-11-16', '10:00'),
      c('b1', 'b', '2026-11-16', '11:30', { lat: GYM.lat + 0.001, lng: GYM.lng }), // ~110 m
      c('a2', 'a', '2026-11-17', '10:00'),
    ])
    expect(r.days).toEqual(['2026-11-16'])
    expect([...r.checkinIds].sort()).toEqual(['a1', 'b1'])
  })

  it('não conta longe, com muitas horas de diferença ou sem GPS', () => {
    const r = findTogether([
      c('a1', 'a', '2026-11-16', '10:00'),
      c('b1', 'b', '2026-11-16', '10:30', { lat: GYM.lat + 0.01, lng: GYM.lng }), // ~1,1 km
      c('a2', 'a', '2026-11-17', '07:00'),
      c('b2', 'b', '2026-11-17', '19:00'),
      c('a3', 'a', '2026-11-18', '10:00', null),
      c('b3', 'b', '2026-11-18', '10:00'),
    ])
    expect(r.days).toEqual([])
    expect(r.checkinIds.size).toBe(0)
  })

  it('não junta a mesma pessoa nem dias diferentes', () => {
    const r = findTogether([c('a1', 'a', '2026-11-16', '10:00'), c('a2', 'a', '2026-11-16', '10:10'), c('b1', 'b', '2026-11-17', '10:00')])
    expect(r.days).toEqual([])
  })

  it('devolve os dias em ordem, cada um uma vez', () => {
    const r = findTogether([
      c('a2', 'a', '2026-11-20', '10:00'),
      c('b2', 'b', '2026-11-20', '10:00'),
      c('c2', 'c', '2026-11-20', '10:30'),
      c('a1', 'a', '2026-11-02', '10:00'),
      c('b1', 'b', '2026-11-02', '12:59'),
    ])
    expect(r.days).toEqual(['2026-11-02', '2026-11-20'])
    expect(r.checkinIds.size).toBe(5)
  })
})
