/**
 * Planejar a semana: cada um marca os dias (e o período) em que pretende treinar e vê o plano do outro.
 * O "vamos?" chama o parceiro; o aviso aparece no Início dele (sem notificação por enquanto).
 */
import { View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, Chip, EmptyState, PageHeader, Screen, Spinner, Txt, memberColor, useToast } from '@/components/ui'
import { usePlans, useSendNudge, useSetPlan } from '@/data/queries'
import type { PlanPeriod, WorkoutPlan } from '@/data/types'
import { addDays, dayMonth, isoDow, weekdayLong } from '@domain/dates'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

export const PERIOD_LABEL: Record<PlanPeriod, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

/** Texto curto do plano de alguém num dia: "Tarde", "Vai treinar" ou "Sem plano". */
export function planText(plan: WorkoutPlan | undefined): string {
  if (!plan) return 'Sem plano'
  return plan.period ? PERIOD_LABEL[plan.period] : 'Vai treinar'
}

/** Botão "vamos?": chama todo mundo do grupo, menos a própria pessoa. */
export function NudgeButton({ style }: { style?: object }) {
  const { group, members, userId } = useGroup()
  const send = useSendNudge(group.id)
  const toast = useToast()
  const others = members.filter((m) => m.user_id !== userId)
  if (others.length === 0) return null
  return (
    <Button
      variant="secondary"
      style={style}
      loading={send.isPending}
      onPress={() =>
        send.mutate(
          others.map((m) => m.user_id),
          {
            onSuccess: () => toast(`Chamado! ${others.map((m) => m.display_name.split(' ')[0]).join(' e ')} vai ver quando abrir o app`),
            onError: (err) => toast(errorMessage(err), 'error'),
          },
        )
      }
    >
      💪 Vamos?
    </Button>
  )
}

export function PlanScreen() {
  const { group, members, userId, today, rules } = useGroup()
  const until = addDays(today, 13)
  const plans = usePlans(group.id, today, until)
  const setPlan = useSetPlan(group.id)
  const toast = useToast()

  // Hoje e os próximos 13 dias, sem domingo quando ele é folga.
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter((d) => rules.sundayCounts || isoDow(d) !== 7)
  const planOf = (uid: string, day: string) => (plans.data ?? []).find((p) => p.user_id === uid && p.day === day)
  const others = members.filter((m) => m.user_id !== userId)

  function change(day: string, on: boolean, period?: PlanPeriod | null) {
    setPlan.mutate({ day, existing: planOf(userId, day), on, period }, { onError: (err) => toast(errorMessage(err), 'error') })
  }

  if (plans.isError) {
    return (
      <Screen header={<PageHeader title="Planejar a semana" back />}>
        <EmptyState>O planejamento fica disponível depois que a atualização do banco for aplicada no Supabase.</EmptyState>
      </Screen>
    )
  }

  return (
    <Screen header={<PageHeader title="Planejar a semana" subtitle="Marque quando vai treinar e veja o plano do outro" back />}>
      <Card style={{ borderColor: alpha(colors.accent, 0.4) }}>
        <Txt size={14}>Bateu a preguiça no outro? Chame agora:</Txt>
        <NudgeButton style={{ marginTop: 8 }} />
        <Txt size={12} muted style={{ marginTop: 4 }}>
          O aviso aparece no Início dele. Dá para chamar de novo depois de meia hora.
        </Txt>
      </Card>

      {plans.isLoading ? (
        <Spinner />
      ) : (
        days.map((day) => {
          const mine = planOf(userId, day)
          return (
            <Card key={day} style={day === today ? { borderColor: alpha(colors.accent, 0.4) } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt weight="600">
                  {day === today ? 'Hoje' : weekdayLong(day)} · {dayMonth(day)}
                </Txt>
                <Chip
                  label={mine ? '✓ Vou treinar' : 'Vou treinar'}
                  active={Boolean(mine)}
                  onPress={() => change(day, !mine)}
                  accessibilityLabel={`Vou treinar ${dayMonth(day)}`}
                />
              </View>
              {mine && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {(Object.keys(PERIOD_LABEL) as PlanPeriod[]).map((p) => (
                    <Chip
                      key={p}
                      label={PERIOD_LABEL[p]}
                      active={mine.period === p}
                      onPress={() => change(day, true, mine.period === p ? null : p)}
                      accessibilityLabel={`${PERIOD_LABEL[p]} ${dayMonth(day)}`}
                    />
                  ))}
                </View>
              )}
              {others.map((m) => {
                const theirs = planOf(m.user_id, day)
                return (
                  <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: memberColor(members.indexOf(m)) }} />
                    <Txt size={12} muted={!theirs}>
                      {m.display_name.split(' ')[0]}: {planText(theirs)}
                    </Txt>
                  </View>
                )
              })}
            </Card>
          )
        })
      )}
    </Screen>
  )
}
