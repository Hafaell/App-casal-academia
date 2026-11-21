/**
 * Resposta do parceiro a uma exceção: aprovar ou recusar até as 23h59 do dia em que ela foi
 * marcada. Sem resposta até lá, ela vale. Quem marcou vê "aguardando resposta".
 */
import { useState } from 'react'
import { View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Field, Input, Sheet, Txt, useToast } from '@/components/ui'
import { useReviewException } from '@/data/queries'
import type { ExceptionDay } from '@/data/types'
import { dayMonth, weekdayShort } from '@domain/dates'
import { awaitingReview, reviewState } from '@domain/exceptionReview'
import { EXCEPTION_REASONS } from '@domain/rules'
import { errorMessage } from '@/lib/supabase'
import { colors } from '@/lib/theme'

const asReviewable = (e: ExceptionDay) => ({ user_id: e.user_id, created_at: e.created_at, reviewed_at: e.reviewed_at ?? null })

/** Exceções de outras pessoas que eu ainda posso responder hoje. */
export function useOpenReviews(list: ExceptionDay[] | undefined): ExceptionDay[] {
  const { userId, today, group } = useGroup()
  return (list ?? []).filter((e) => reviewState(asReviewable(e), userId, today, group.timezone) === 'open')
}

export function ExceptionReviewBar({ exception }: { exception: ExceptionDay }) {
  const { userId, today, group, nameOf } = useGroup()
  const review = useReviewException()
  const toast = useToast()
  const [rejecting, setRejecting] = useState(false)
  const [why, setWhy] = useState('')
  const state = reviewState(asReviewable(exception), userId, today, group.timezone)

  function send(approve: boolean) {
    review.mutate(
      { id: exception.id, approve, why: approve ? undefined : why },
      {
        onSuccess: () => {
          toast(approve ? 'Exceção aprovada' : 'Exceção recusada: o dia volta a contar na meta')
          setRejecting(false)
          setWhy('')
        },
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    )
  }

  if (state === 'approved') {
    return (
      <Txt size={12} color={colors.ok} style={{ marginTop: 4 }}>
        ✓ Aprovada por {nameOf(exception.reviewed_by ?? '')}
      </Txt>
    )
  }
  if (state === 'mine') {
    return awaitingReview(asReviewable(exception), today, group.timezone) ? (
      <Txt size={12} muted style={{ marginTop: 4 }}>
        ⏳ Aguardando o parceiro até 23h59 de hoje. Sem resposta, ela vale.
      </Txt>
    ) : null
  }
  if (state === 'expired') return null

  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      <Txt size={12} color={colors.warn}>
        Responda até 23h59 de hoje. Sem resposta, a exceção vale.
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={() => send(true)} disabled={review.isPending}>
          ✓ Aprovar
        </Button>
        <Button variant="danger" style={{ flex: 1 }} onPress={() => setRejecting(true)} disabled={review.isPending}>
          ✕ Recusar
        </Button>
      </View>
      <Sheet open={rejecting} onClose={() => setRejecting(false)}>
        {rejecting && (
          <View style={{ gap: 16 }}>
            <Txt size={18} weight="600">
              Recusar a exceção de {nameOf(exception.user_id)}?
            </Txt>
            <Txt size={14} muted>
              {weekdayShort(exception.day)} {dayMonth(exception.day)} · {EXCEPTION_REASONS[exception.reason]}. Recusada, ela some e o dia volta a
              contar na meta. Fica um aviso no feed.
            </Txt>
            <Field label="Motivo (opcional)">
              <Input placeholder="Ex.: Você foi trabalhar normal" value={why} onChangeText={setWhy} maxLength={200} />
            </Field>
            <Button variant="danger" onPress={() => send(false)} loading={review.isPending}>
              Recusar exceção
            </Button>
          </View>
        )}
      </Sheet>
    </View>
  )
}
