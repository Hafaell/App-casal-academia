/**
 * Distâncias e verificação "está na academia".
 * O banco repete este cálculo (public.distance_m) e é ele quem decide de verdade;
 * aqui serve só para mostrar o aviso ao vivo na câmera.
 */

/** Raio permitido em volta da academia. Igual a public.gym_radius_m() no banco. */
export const GYM_RADIUS_M = 100

/** Acima disso o banco recusa o check-in por GPS impreciso. */
export const MAX_ACCURACY_M = 500

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6371000
const rad = (deg: number) => (deg * Math.PI) / 180

/** Distância em metros entre dois pontos (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function nearest<T extends LatLng>(from: LatLng, places: T[]): { place: T; distance: number } | null {
  let best: { place: T; distance: number } | null = null
  for (const place of places) {
    const distance = distanceMeters(from, place)
    if (!best || distance < best.distance) best = { place, distance }
  }
  return best
}

export type LocationCheck<T> =
  | { status: 'no-gym' }
  | { status: 'weak-signal'; accuracy: number }
  | { status: 'far'; place: T; distance: number }
  | { status: 'ok'; place: T; distance: number }

/** Mesma ordem de regras do gatilho de check-in no banco. */
export function checkLocation<T extends LatLng>(position: LatLng & { accuracy?: number }, gyms: T[]): LocationCheck<T> {
  const best = nearest(position, gyms)
  if (!best) return { status: 'no-gym' }
  if (position.accuracy !== undefined && position.accuracy > MAX_ACCURACY_M)
    return { status: 'weak-signal', accuracy: position.accuracy }
  const distance = Math.round(best.distance)
  if (distance > GYM_RADIUS_M) return { status: 'far', place: best.place, distance }
  return { status: 'ok', place: best.place, distance }
}

/** "45 m" ou "1,2 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`
}
