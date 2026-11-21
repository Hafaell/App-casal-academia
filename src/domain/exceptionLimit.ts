/**
 * Limite mensal de exceções: cada pessoa marca no máximo N por mês, contadas pelo mês do dia
 * justificado. O banco confere em exceptions_before_insert; aqui serve para a tela avisar antes.
 */
import { monthKey, type ISODate } from './dates'

/** Igual ao padrão de groups.exceptions_per_month no banco. */
export const DEFAULT_EXCEPTIONS_PER_MONTH = 4

export function exceptionsUsedInMonth(list: { user_id: string; day: ISODate }[], userId: string, anyDayOfMonth: ISODate): number {
  const month = monthKey(anyDayOfMonth)
  return list.filter((e) => e.user_id === userId && monthKey(e.day) === month).length
}

export function exceptionsLeft(list: { user_id: string; day: ISODate }[], userId: string, anyDayOfMonth: ISODate, limit: number): number {
  return Math.max(0, limit - exceptionsUsedInMonth(list, userId, anyDayOfMonth))
}
