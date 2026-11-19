/** Dados de um casal em uso: grupo, academias, treinos, uma semana fechada com multa. */
import { createFakeSupabase } from './fakeSupabase'
import { fakeState } from './fakeState'

/** Quarta-feira, 18/11/2026, meio-dia em Brasília. */
export const NOW = new Date('2026-11-18T15:00:00Z')

export const GYM = { lat: -20.6711, lng: -40.4997 }

export function seedCouple() {
  const fake = createFakeSupabase()
  fakeState.supabase = fake
  fakeState.position = { lat: GYM.lat + 0.0002, lng: GYM.lng, accuracy: 12 } // ~22 m da academia
  fake.login('u1', 'Rafael')
  fake.addUser('u2', 'Ana', 'ana@teste.com', 'segredo')
  const db = fake.db

  db.groups = [
    {
      id: 'g1',
      name: 'Nós dois',
      invite_code: 'XYZ789',
      weekly_goal: 4,
      fine_min: 10,
      fine_max: 50,
      sunday_counts: false,
      jokers_per_month: 1,
      timezone: 'America/Sao_Paulo',
      starts_on: '2026-11-02',
      require_location: true,
    },
  ]
  db.group_members = [
    { group_id: 'g1', user_id: 'u1', role: 'owner', starts_on: '2026-11-02', joined_at: '2026-11-01T10:00:00Z' },
    { group_id: 'g1', user_id: 'u2', role: 'member', starts_on: '2026-11-02', joined_at: '2026-11-01T11:00:00Z' },
  ]
  db.gyms = [
    { id: 'gym1', group_id: 'g1', name: 'Smart Fit Centro', address: 'Rua A, 1', place_id: null, ...GYM, created_by: 'u1', created_at: '2026-11-01T12:00:00Z' },
    { id: 'gym2', group_id: 'g1', name: 'Academia da Ana', address: null, place_id: null, lat: -20.66, lng: -40.49, created_by: 'u2', created_at: '2026-11-01T12:00:00Z' },
  ]
  const checkin = (id: string, user: string, day: string, hour = '13') => ({
    id,
    group_id: 'g1',
    user_id: user,
    day,
    photo_path: `g1/${user}/${id}.jpg`,
    created_at: `${day}T${hour}:00:00Z`,
    lat: GYM.lat,
    lng: GYM.lng,
    accuracy_m: 10,
    gym_id: 'gym1',
    gym_name: 'Smart Fit Centro',
    distance_m: 20,
    kind: null,
  })
  db.checkins = [checkin('c1', 'u1', '2026-11-16'), checkin('c2', 'u1', '2026-11-17'), checkin('c3', 'u2', '2026-11-16', '14')]
  db.exceptions = []
  db.jokers = []
  db.reactions = []
  db.checkin_reports = []
  db.kitty_withdrawals = []
  db.punishments = [
    { id: 'p1', group_id: 'g1', kind: 'Tarefa', description: 'Lavar a louça por uma semana', active: true, created_at: '2026-11-01T10:00:00Z' },
    { id: 'p2', group_id: 'g1', kind: 'Date', description: 'Pagar o cinema', active: false, created_at: '2026-11-01T10:01:00Z' },
  ]
  db.weeks = [
    {
      id: 'w1',
      group_id: 'g1',
      week_start: '2026-11-09',
      closed_at: '2026-11-16T02:59:00Z',
      fine_amount: 30,
      punishment_kind: 'Tarefa',
      punishment_text: 'Lavar a louça por uma semana',
    },
  ]
  const result = (user: string, checkins: number, met: boolean) => ({
    week_id: 'w1',
    group_id: 'g1',
    user_id: user,
    week_start: '2026-11-09',
    base_goal: 4,
    exception_days: 0,
    goal: 4,
    checkins,
    used_joker: false,
    met,
    owes: !met,
    fine_amount: met ? 0 : 30,
    punishment_text: met ? null : 'Lavar a louça por uma semana',
    paid_at: null,
    paid_marked_by: null,
    task_done_at: null,
  })
  db.week_results = [result('u1', 4, true), result('u2', 2, false)]
  return fake
}
