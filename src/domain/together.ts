/**
 * "Treino a dois": duas pessoas do grupo treinaram no mesmo dia, no mesmo lugar e perto da mesma hora.
 * É só estatística. Não vale treino a mais nem muda meta ou multa (essas regras ficam no banco).
 */
import { distanceMeters } from './geo'

/** Distância máxima entre as duas fotos. Maior que o raio da academia porque o GPS dentro do prédio erra. */
export const TOGETHER_RADIUS_M = 200

/** Diferença máxima de horário entre as duas fotos. */
export const TOGETHER_WINDOW_MS = 3 * 60 * 60 * 1000

export interface TogetherCheckin {
  id: string
  user_id: string
  day: string
  lat: number | null
  lng: number | null
  created_at: string
}

export interface TogetherResult {
  /** Dias (AAAA-MM-DD) em que houve treino a dois, em ordem. */
  days: string[]
  /** Check-ins que fazem parte de um treino a dois (para o selo no feed). */
  checkinIds: Set<string>
}

function together(a: TogetherCheckin, b: TogetherCheckin): boolean {
  if (a.user_id === b.user_id || a.day !== b.day) return false
  // Sem GPS não dá para saber se estavam no mesmo lugar.
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false
  if (Math.abs(Date.parse(a.created_at) - Date.parse(b.created_at)) > TOGETHER_WINDOW_MS) return false
  return distanceMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= TOGETHER_RADIUS_M
}

export function findTogether(checkins: TogetherCheckin[]): TogetherResult {
  const byDay = new Map<string, TogetherCheckin[]>()
  for (const c of checkins) {
    const list = byDay.get(c.day) ?? []
    list.push(c)
    byDay.set(c.day, list)
  }
  const days: string[] = []
  const checkinIds = new Set<string>()
  for (const [day, list] of byDay) {
    let found = false
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (together(list[i], list[j])) {
          found = true
          checkinIds.add(list[i].id)
          checkinIds.add(list[j].id)
        }
      }
    }
    if (found) days.push(day)
  }
  days.sort()
  return { days, checkinIds }
}
