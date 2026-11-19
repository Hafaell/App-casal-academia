/**
 * Estado da tela de check-in: o que a faixa de aviso mostra e se o botão de foto libera.
 * Função pura para testar sem abrir câmera nem GPS. O banco continua sendo quem decide de verdade.
 */
import { checkLocation, type LatLng } from './geo'

export interface GateInput<T extends LatLng> {
  /** Regra "Exigir estar na academia" do grupo. */
  required: boolean
  /** Já existe check-in do usuário hoje. */
  trainedToday: boolean
  gyms: { status: 'loading' | 'error' | 'ready'; list: T[] }
  position: (LatLng & { accuracy?: number }) | null
  /** Texto do erro de GPS (negado, indisponível); vazio se não houve erro. */
  gpsError: string
}

export type Gate<T extends LatLng> =
  | { kind: 'trained' }
  | { kind: 'gyms-loading' }
  | { kind: 'gyms-error' }
  | { kind: 'no-gym' }
  | { kind: 'gps-error'; message: string }
  | { kind: 'waiting-gps' }
  | { kind: 'weak-signal'; accuracy: number }
  | { kind: 'far'; place: T; distance: number }
  | { kind: 'ok'; place: T; distance: number }
  /** Regra desligada: pode tirar a foto, mesmo sem academia ou sem GPS. */
  | { kind: 'free'; place?: T; distance?: number }

export function gateFor<T extends LatLng>(i: GateInput<T>): Gate<T> {
  if (i.trainedToday) return { kind: 'trained' }

  if (!i.required) {
    // Só informa: se der para saber a academia, mostra; senão, libera do mesmo jeito.
    const c = i.position && i.gyms.status === 'ready' ? checkLocation(i.position, i.gyms.list) : null
    return c && (c.status === 'ok' || c.status === 'far') ? { kind: 'free', place: c.place, distance: c.distance } : { kind: 'free' }
  }

  if (i.gyms.status === 'error') return { kind: 'gyms-error' }
  if (i.gyms.status === 'loading') return { kind: 'gyms-loading' }
  if (i.gyms.list.length === 0) return { kind: 'no-gym' }
  if (!i.position) return i.gpsError ? { kind: 'gps-error', message: i.gpsError } : { kind: 'waiting-gps' }

  const c = checkLocation(i.position, i.gyms.list)
  switch (c.status) {
    case 'no-gym':
      return { kind: 'no-gym' }
    case 'weak-signal':
      return { kind: 'weak-signal', accuracy: c.accuracy }
    case 'far':
      return { kind: 'far', place: c.place, distance: c.distance }
    case 'ok':
      return { kind: 'ok', place: c.place, distance: c.distance }
  }
}

/** Libera o botão de foto. */
export const canShoot = (g: Gate<LatLng>): boolean => g.kind === 'ok' || g.kind === 'free'
