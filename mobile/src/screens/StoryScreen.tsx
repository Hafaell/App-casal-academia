/** Nossa história: relatório do mês (só números). Stories e colagens ficam na tela Compartilhar. */
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useGroup } from '@/providers/GroupProvider'
import { Avatar, Card, PageHeader, Screen, Spinner, Txt, memberColor } from '@/components/ui'
import { MonthPicker } from '@/components/MonthPicker'
import { useCheckins, useWeekResults } from '@/data/queries'
import { addDays, firstOfMonth, weekdayLong } from '@domain/dates'
import { DAY_PERIOD_LABEL, monthReport } from '@domain/report'
import { formatMoney } from '@domain/rules'
import { groupStreak } from '@domain/streak'
import { alpha, colors } from '@/lib/theme'

/** Nome do dia da semana (1 = segunda ... 7 = domingo), a partir de uma segunda qualquer. */
export const dowName = (dow: number) => weekdayLong(addDays('2026-11-16', dow - 1))

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function StoryScreen() {
  const { group, members, today } = useGroup()
  const [month, setMonth] = useState(firstOfMonth(today))
  const year = month.slice(0, 4)

  const checkins = useCheckins(group.id, `${year}-01-01`, `${year}-12-31`)
  const results = useWeekResults(group.id)
  const memberKey = members.map((m) => m.user_id).join()

  const report = useMemo(
    () =>
      monthReport({
        month,
        memberIds: memberKey.split(','),
        checkins: checkins.data ?? [],
        results: results.data ?? [],
        timeZone: group.timezone,
      }),
    [month, memberKey, checkins.data, results.data, group.timezone],
  )
  const streak = useMemo(
    () => groupStreak((results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker }))),
    [results.data],
  )

  const couple = members.length === 2 ? 'os dois' : 'todo mundo'
  const colorOf = (userId: string) => memberColor(members.findIndex((m) => m.user_id === userId))
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.display_name ?? 'Alguém'

  return (
    <Screen header={<PageHeader title="Nossa história" subtitle="Relatório do mês" back />}>
      <MonthPicker month={month} onChange={setMonth} />

      {checkins.isLoading || results.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Card style={{ alignItems: 'center', borderColor: alpha(colors.accent, 0.4), backgroundColor: alpha(colors.accent, 0.05) }}>
            <Txt size={14} muted>
              Treinaram juntos
            </Txt>
            <Txt size={44} weight="700">
              💑 {report.together}
            </Txt>
            <Txt size={12} muted center>
              Mesmo dia, até 200 m um do outro e até 3 horas de diferença
            </Txt>
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Stat label="Treinos no mês" value={String(report.checkins)} />
            <Stat label={`Semanas que ${couple} bateram`} value={`${report.weeksAllMet}/${report.weeks}`} />
            <Stat label="Multas do mês" value={formatMoney(report.fines)} />
            <Stat label="Sequência atual" value={`🔥 ${streak.current}`} />
          </View>

          {(report.bestWeekday || report.bestPeriod) && (
            <Card>
              {report.bestWeekday && (
                <Txt size={14}>
                  📅 Dia preferido: <Txt size={14} weight="700">{dowName(report.bestWeekday.dow)}</Txt> (
                  {plural(report.bestWeekday.count, 'treino', 'treinos')})
                </Txt>
              )}
              {report.bestPeriod && (
                <Txt size={14} style={{ marginTop: 4 }}>
                  🕒 Mais treinam <Txt size={14} weight="700">{DAY_PERIOD_LABEL[report.bestPeriod.period]}</Txt> (
                  {plural(report.bestPeriod.count, 'treino', 'treinos')})
                </Txt>
              )}
            </Card>
          )}

          <Card>
            <View style={{ gap: 12 }}>
              {report.people.map((p) => (
                <View key={p.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={nameOf(p.userId)} color={colorOf(p.userId)} size={32} />
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="600">
                      {nameOf(p.userId)}
                    </Txt>
                    <Txt size={12} muted>
                      Bateu {p.weeksMet}/{p.weeks} {p.weeks === 1 ? 'semana' : 'semanas'}
                      {p.fines > 0 ? ` · multas ${formatMoney(p.fines)}` : ''}
                    </Txt>
                  </View>
                  <Txt size={18} weight="700">
                    {plural(p.checkins, 'treino', 'treinos')}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>

          <Pressable onPress={() => router.push('/compartilhar')} accessibilityRole="link">
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt size={14}>📤 Stories e colagens para compartilhar</Txt>
              <Txt muted>›</Txt>
            </Card>
          </Pressable>
        </>
      )}
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Txt size={12} muted>
        {label}
      </Txt>
      <Txt size={22} weight="700">
        {value}
      </Txt>
    </Card>
  )
}
