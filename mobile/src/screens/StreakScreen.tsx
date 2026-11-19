import { useMemo } from 'react'
import { View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Avatar, Card, EmptyState, PageHeader, Screen, Spinner, Txt, memberColor } from '@/components/ui'
import { useWeekResults } from '@/data/queries'
import { weekRange } from '@domain/dates'
import { groupStreak, personStreak, type WeekOutcome } from '@domain/streak'
import { alpha, colors } from '@/lib/theme'

export function StreakScreen() {
  const { group, members } = useGroup()
  const results = useWeekResults(group.id)

  const outcomes = useMemo<WeekOutcome[]>(
    () => (results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker })),
    [results.data],
  )
  const weeks = [...new Set(outcomes.map((o) => o.weekStart))].sort().reverse()
  const together = groupStreak(outcomes)

  return (
    <Screen header={<PageHeader title="Sequência" back />}>
      {results.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Card style={{ borderColor: alpha(colors.accent, 0.4), backgroundColor: alpha(colors.accent, 0.05), alignItems: 'center' }}>
            <Txt size={14} muted>
              {members.length === 2 ? 'O casal' : 'O grupo todo'}
            </Txt>
            <Txt size={48} weight="700">
              🔥 {together.current}
            </Txt>
            <Txt size={14} muted>
              {together.current === 1 ? 'semana seguida' : 'semanas seguidas'} · recorde {together.best}
            </Txt>
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {members.map((m, i) => {
              const s = personStreak(outcomes.filter((o) => o.userId === m.user_id))
              return (
                <Card key={m.user_id} style={{ alignItems: 'center', flexBasis: '47%', flexGrow: 1 }}>
                  <View style={{ marginBottom: 8 }}>
                    <Avatar name={m.display_name} color={memberColor(i)} />
                  </View>
                  <Txt size={14} weight="600" numberOfLines={1}>
                    {m.display_name}
                  </Txt>
                  <Txt size={30} weight="700">
                    {s.current}
                  </Txt>
                  <Txt size={12} muted>
                    recorde {s.best}
                  </Txt>
                </Card>
              )
            })}
          </View>

          <Txt size={12} muted>
            Semana salva pelo coringa não quebra a sequência, mas também não soma.
          </Txt>

          {weeks.length === 0 ? (
            <EmptyState>A primeira semana fecha no domingo às 23h59.</EmptyState>
          ) : (
            <Card style={{ padding: 0 }}>
              <View style={{ flexDirection: 'row', padding: 12 }}>
                <Txt size={12} muted style={{ flex: 2 }}>
                  Semana
                </Txt>
                {members.map((m) => (
                  <Txt key={m.user_id} size={12} muted center style={{ flex: 1 }} numberOfLines={1}>
                    {m.display_name.split(' ')[0]}
                  </Txt>
                ))}
              </View>
              {weeks.map((w) => (
                <View key={w} style={{ flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
                  <Txt size={14} style={{ flex: 2 }}>
                    {weekRange(w)}
                  </Txt>
                  {members.map((m) => {
                    const o = outcomes.find((x) => x.weekStart === w && x.userId === m.user_id)
                    return (
                      <Txt key={m.user_id} size={14} center style={{ flex: 1 }}>
                        {!o ? '·' : o.met ? '✅' : o.usedJoker ? '🃏' : '❌'}
                      </Txt>
                    )
                  })}
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  )
}
