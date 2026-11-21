/**
 * Resposta do parceiro à exceção. Quem não marcou pode recusar até as 23h59 (fuso do grupo)
 * do dia em que a exceção foi marcada; depois disso ela vale sozinha. O banco confere de novo
 * em public.review_exception; aqui serve para a tela mostrar os botões e o prazo.
 */
import { localDate, type ISODate } from './dates'

export interface ReviewableException {
  user_id: string
  created_at: string
  reviewed_at: string | null
}

export type ReviewState = 'mine' | 'approved' | 'open' | 'expired'

export function reviewState(e: ReviewableException, me: string, today: ISODate, timeZone: string): ReviewState {
  if (e.reviewed_at) return 'approved'
  if (e.user_id === me) return 'mine'
  return localDate(e.created_at, timeZone) >= today ? 'open' : 'expired'
}

/** A exceção ainda espera a resposta de alguém (para o autor ver "aguardando"). */
export function awaitingReview(e: ReviewableException, today: ISODate, timeZone: string): boolean {
  return !e.reviewed_at && localDate(e.created_at, timeZone) >= today
}
