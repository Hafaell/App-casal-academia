/**
 * Avisos da leva 2 no Início: "vamos?" recebido, exceção esperando resposta, giro de prêmio
 * disponível, e o plano de hoje. Se a atualização do banco ainda não foi aplicada, as consultas
 * dão erro e cada aviso simplesmente não aparece.
 */
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, Txt } from '@/components/ui'
import { ExceptionReviewBar, useOpenReviews } from '@/components/ExceptionReview'
import { useExceptions, useMyNudges, usePlans, useSeeNudges } from '@/data/queries'
import { addDays, dayMonth, localTime, weekdayShort } from '@domain/dates'
import { EXCEPTION_REASONS } from '@domain/rules'
import { usePendingRewards } from '@/screens/RewardsScreen'
import { NudgeButton, planText } from '@/screens/PlanScreen'
import { alpha, colors } from '@/lib/theme'

export function HomeAlerts() {
  return (
    <>
      <NudgeInbox />
      <ReviewRequests />
      <RewardBanner />
    </>
  )
}

function NudgeInbox() {
  const { group, userId, nameOf } = useGroup()
  const nudges = useMyNudges(group.id, userId)
  const see = useSeeNudges()
  const unseen = (nudges.data ?? []).filter((n) => !n.seen_at)
  if (unseen.length === 0) return null
  const names = [...new Set(unseen.map((n) => nameOf(n.from_user)))].join(' e ')
  const last = unseen[0]
  const dismiss = () => see.mutate(unseen.map((n) => n.id))
  return (
    <Card style={{ borderColor: alpha(colors.accent, 0.5), backgroundColor: alpha(colors.accent, 0.08) }}>
      <Txt size={18} weight="700">
        💪 {names} chamou: bora treinar?
      </Txt>
      <Txt size={12} muted>
        às {localTime(last.created_at, group.timezone)}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button
          style={{ flex: 1 }}
          onPress={() => {
            dismiss()
            router.push('/check-in')
          }}
        >
          Bora!
        </Button>
        <Button variant="secondary" style={{ flex: 1 }} onPress={dismiss}>
          Agora não
        </Button>
      </View>
    </Card>
  )
}

function ReviewRequests() {
  const { group, monday, today, nameOf } = useGroup()
  const exceptions = useExceptions(group.id, monday, addDays(today, 60))
  const open = useOpenReviews(exceptions.data)
  if (open.length === 0) return null
  return (
    <Card style={{ borderColor: alpha(colors.warn, 0.4), backgroundColor: alpha(colors.warn, 0.05) }}>
      <Txt size={14} weight="700" color={colors.warn}>
        Exceção esperando a sua resposta
      </Txt>
      {open.map((e) => (
        <View key={e.id} style={{ marginTop: 8 }}>
          <Txt size={14}>
            <Txt size={14} weight="700">
              {nameOf(e.user_id)}
            </Txt>{' '}
            justificou {weekdayShort(e.day)} {dayMonth(e.day)}: {EXCEPTION_REASONS[e.reason]}
            {e.note ? <Txt size={14} muted>{` · “${e.note}”`}</Txt> : null}
          </Txt>
          <ExceptionReviewBar exception={e} />
        </View>
      ))}
    </Card>
  )
}

function RewardBanner() {
  const { pending } = usePendingRewards()
  if (pending.length === 0) return null
  return (
    <Pressable onPress={() => router.push('/premios')} accessibilityRole="link">
      <Card style={{ borderColor: alpha(colors.ok, 0.4), backgroundColor: alpha(colors.ok, 0.08) }}>
        <Txt size={18} weight="700">
          🎁 Vocês ganharam um giro na roleta de prêmios!
        </Txt>
        <Txt size={14} color={colors.accent} style={{ marginTop: 4 }}>
          Girar agora ›
        </Txt>
      </Card>
    </Pressable>
  )
}

/** Plano de hoje de cada um, com o "vamos?" e o atalho para planejar. */
export function TodayPlanCard() {
  const { group, members, userId, today } = useGroup()
  const plans = usePlans(group.id, today, today)
  if (plans.isError) return null
  const planOf = (uid: string) => (plans.data ?? []).find((p) => p.user_id === uid)
  const ordered = [...members].sort((a, b) => (a.user_id === userId ? -1 : b.user_id === userId ? 1 : 0))
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt size={14} muted>
          Plano de hoje
        </Txt>
        <Pressable onPress={() => router.push('/planejar')} accessibilityRole="link" hitSlop={10}>
          <Txt size={14} color={colors.accent}>
            Planejar ›
          </Txt>
        </Pressable>
      </View>
      {ordered.map((m) => (
        <Txt key={m.user_id} size={14} style={{ marginTop: 4 }}>
          {`${m.user_id === userId ? 'Você' : m.display_name.split(' ')[0]}: ${planText(planOf(m.user_id))}`}
        </Txt>
      ))}
      <NudgeButton style={{ marginTop: 12 }} />
    </Card>
  )
}
