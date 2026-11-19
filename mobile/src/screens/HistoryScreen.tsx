import { useMemo, useState } from 'react'
import { Image, Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Card, EmptyState, PageHeader, PhotoViewer, Screen, Sheet, Spinner, Txt, memberColor } from '@/components/ui'
import { useCheckins, useExceptions, usePhotoUrls, useWeekResults, useWeeks } from '@/data/queries'
import type { Checkin } from '@/data/types'
import { addDays, addMonths, dayMonth, daysInMonth, firstOfMonth, isoDow, localTime, monthLabel, mondayOf, weekRange, weekdayLong } from '@domain/dates'
import { EXCEPTION_REASONS, formatMoney } from '@domain/rules'
import { alpha, colors } from '@/lib/theme'

const WEEK_HEADER = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const CELL = `${100 / 7}%` as const

export function HistoryScreen() {
  const { group, today, members, nameOf } = useGroup()
  const [month, setMonth] = useState(firstOfMonth(today))
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)

  const gridStart = mondayOf(month)
  const lastOfMonth = addDays(month, daysInMonth(month) - 1)
  const gridEnd = addDays(mondayOf(lastOfMonth), 6)

  const checkins = useCheckins(group.id, gridStart, gridEnd)
  const exceptions = useExceptions(group.id, gridStart, gridEnd)
  const weeks = useWeeks(group.id)
  const results = useWeekResults(group.id)
  const photos = usePhotoUrls((checkins.data ?? []).map((c) => c.photo_path))

  const byDay = useMemo(() => {
    const map = new Map<string, Checkin[]>()
    for (const c of checkins.data ?? []) map.set(c.day, [...(map.get(c.day) ?? []), c])
    return map
  }, [checkins.data])

  const colorOf = (uid: string) => memberColor(members.findIndex((m) => m.user_id === uid))

  const days: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)

  const monthWeeks = (weeks.data ?? []).filter((w) => w.week_start <= lastOfMonth && addDays(w.week_start, 6) >= month)
  const dayCheckins = openDay ? (byDay.get(openDay) ?? []) : []
  const dayExceptions = openDay ? (exceptions.data ?? []).filter((e) => e.day === openDay) : []
  const isCurrentMonth = month >= firstOfMonth(today)

  return (
    <Screen header={<PageHeader title="Histórico" />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setMonth(addMonths(month, -1))} accessibilityLabel="Mês anterior" style={navButton}>
          <Txt size={18}>‹</Txt>
        </Pressable>
        <Txt weight="600">{monthLabel(month)}</Txt>
        <Pressable
          onPress={() => setMonth(addMonths(month, 1))}
          disabled={isCurrentMonth}
          accessibilityLabel="Próximo mês"
          style={[navButton, isCurrentMonth && { opacity: 0.3 }]}
        >
          <Txt size={18}>›</Txt>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {members.map((m, i) => (
          <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: memberColor(i) }} />
            <Txt size={12} muted>
              {m.display_name}
            </Txt>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.warn }} />
          <Txt size={12} muted>
            exceção
          </Txt>
        </View>
      </View>

      {checkins.isLoading ? (
        <Spinner />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2 }}>
          {WEEK_HEADER.map((h, i) => (
            <View key={i} style={{ width: CELL, paddingBottom: 4 }}>
              <Txt size={11} muted center>
                {h}
              </Txt>
            </View>
          ))}
          {days.map((d) => {
            const list = byDay.get(d) ?? []
            const exc = (exceptions.data ?? []).filter((e) => e.day === d)
            const inMonth = d >= month && d <= lastOfMonth
            const thumb = list[0] ? photos.data?.get(list[0].photo_path) : undefined
            const restDay = isoDow(d) === 7 && !group.sunday_counts
            return (
              <View key={d} style={{ width: CELL, padding: 2 }}>
                <Pressable
                  onPress={() => (list.length || exc.length ? setOpenDay(d) : undefined)}
                  accessibilityLabel={`${weekdayLong(d)}, ${dayMonth(d)}`}
                  style={{
                    aspectRatio: 1,
                    overflow: 'hidden',
                    borderRadius: 8,
                    borderWidth: d === today ? 2 : 1,
                    borderColor: d === today ? colors.accent : inMonth ? colors.line : 'transparent',
                    backgroundColor: inMonth && !restDay ? colors.surface : alpha(colors.surface, 0.5),
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  {thumb && <Image source={{ uri: thumb }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.6 }} resizeMode="cover" />}
                  <Txt size={11} weight="600" style={{ marginLeft: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 2 }}>
                    {Number(d.slice(8))}
                  </Txt>
                  {list.length > 0 && (
                    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, flexDirection: 'row' }}>
                      {list.map((c) => (
                        <View key={c.id} style={{ flex: 1, backgroundColor: colorOf(c.user_id) }} />
                      ))}
                    </View>
                  )}
                  <View style={{ position: 'absolute', bottom: 8, left: 4, flexDirection: 'row', gap: 2 }}>
                    {list.map((c) => (
                      <View key={c.id} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorOf(c.user_id), borderWidth: 1, borderColor: 'rgba(0,0,0,0.4)' }} />
                    ))}
                    {exc.map((e) => (
                      <View key={e.id} style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.warn }} />
                    ))}
                  </View>
                </Pressable>
              </View>
            )
          })}
        </View>
      )}

      <Txt weight="600" style={{ paddingTop: 8 }}>
        Semanas
      </Txt>
      {monthWeeks.length === 0 ? (
        <EmptyState>Nenhuma semana fechada neste mês ainda.</EmptyState>
      ) : (
        monthWeeks.map((w) => {
          const rows = (results.data ?? []).filter((r) => r.week_id === w.id)
          const owing = rows.filter((r) => r.owes)
          return (
            <Card key={w.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt weight="600">{weekRange(w.week_start)}</Txt>
                <Txt size={12} weight="600" color={owing.length ? colors.danger : colors.ok}>
                  {owing.length ? 'Teve punição' : 'Todos cumpriram'}
                </Txt>
              </View>
              <View style={{ marginTop: 8, gap: 4 }}>
                {rows.map((r) => (
                  <View key={r.user_id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt size={14}>{nameOf(r.user_id)}</Txt>
                    <Txt size={14} muted style={{ fontVariant: ['tabular-nums'] }}>
                      {r.checkins}/{r.goal}
                      {r.exception_days > 0 && ` (−${r.exception_days} exc.)`} {r.met ? '✓' : r.used_joker ? '🃏' : '✗'}
                    </Txt>
                  </View>
                ))}
              </View>
              {owing.length > 0 && (
                <Txt size={14} style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line }}>
                  {formatMoney(w.fine_amount ?? 0)}
                  {w.punishment_text ? ` + ${w.punishment_text}` : ''}
                </Txt>
              )}
            </Card>
          )
        })
      )}

      <Sheet open={Boolean(openDay)} onClose={() => setOpenDay(null)}>
        {openDay && (
          <View style={{ gap: 12 }}>
            <Txt size={18} weight="600">
              {weekdayLong(openDay).charAt(0).toUpperCase() + weekdayLong(openDay).slice(1)}, {dayMonth(openDay)}
            </Txt>
            {dayExceptions.map((e) => (
              <Txt key={e.id} size={14}>
                <Txt size={14} weight="700">
                  {nameOf(e.user_id)}
                </Txt>
                :{' '}
                <Txt size={14} color={colors.warn}>
                  {EXCEPTION_REASONS[e.reason]}
                </Txt>
                {e.note ? <Txt size={14} muted>{` · ${e.note}`}</Txt> : null}
              </Txt>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {dayCheckins.map((c) => {
                const url = photos.data?.get(c.photo_path)
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => url && setViewing(url)}
                    style={{ width: '48%', overflow: 'hidden', borderRadius: 12, borderWidth: 2, borderColor: colorOf(c.user_id), backgroundColor: colors.surface2 }}
                  >
                    {url && <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 4 / 5 }} resizeMode="cover" />}
                    <Txt size={12} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                      {nameOf(c.user_id)} · {localTime(c.created_at, group.timezone)}
                    </Txt>
                  </Pressable>
                )
              })}
            </View>
            {/* Dentro da folha: no iPhone uma janela só abre por cima de outra se estiver dentro dela. */}
            <PhotoViewer url={viewing} onClose={() => setViewing(null)} />
          </View>
        )}
      </Sheet>
    </Screen>
  )
}

const navButton = { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' } as const
