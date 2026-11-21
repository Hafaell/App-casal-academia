import { useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { useGroup } from '@/providers/GroupProvider'
import { Avatar, Button, Card, Spinner, Txt, memberColor } from '@/components/ui'
import { useCheckins, useGyms, useWeekResults, useWeeks } from '@/data/queries'
import { useWeekBoard, type MemberWeek } from '@/data/useWeekBoard'
import { ChallengeHomeCard, HomeAlerts, TodayPlanCard } from '@/components/HomeExtras'
import type { Week, WeekResult } from '@/data/types'
import { addDays, dayMonth, firstOfMonth, isoDow, monthKey, monthName, weekRange, weekdayShort } from '@domain/dates'
import { formatMoney } from '@domain/rules'
import { groupStreak } from '@domain/streak'
import { findTogether } from '@domain/together'
import { readLocal, writeLocal } from '@/lib/storage'
import { alpha, colors } from '@/lib/theme'

export function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { group, members, userId, today, monday, rules } = useGroup()
  const { board, jokers, isLoading } = useWeekBoard()
  const weeks = useWeeks(group.id)
  const results = useWeekResults(group.id)
  const gyms = useGyms(group.id)
  const monthCheckins = useCheckins(group.id, firstOfMonth(today), today)
  const togetherThisMonth = useMemo(() => findTogether(monthCheckins.data ?? []).days.length, [monthCheckins.data])
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  // Com a regra de localização ligada, o treino só vale perto de uma academia cadastrada.
  const needsGym = group.require_location && gyms.isSuccess && !gyms.data.some((g) => g.created_by === userId)

  const lastDow = rules.sundayCounts ? 7 : 6
  const daysLeftInWeek = Math.max(0, lastDow - isoDow(today) + 1)
  const isRestDay = isoDow(today) === 7 && !rules.sundayCounts

  const mine = board?.find((b) => b.member.user_id === userId)
  const jokerAvailable =
    (jokers ?? []).filter((j) => j.user_id === userId && monthKey(j.week_start) === monthKey(monday)).length < group.jokers_per_month

  const streak = useMemo(
    () => groupStreak((results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker }))),
    [results.data],
  )

  // Puxar a tela para baixo recarrega (no site, isso era recarregar a página).
  async function refresh() {
    setRefreshing(true)
    await qc.invalidateQueries()
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 8 }}>
        <Txt size={14} muted>
          {group.name}
        </Txt>
        <Txt size={24} weight="700">
          Semana {weekRange(monday)}
        </Txt>
        <Txt size={14} muted>
          {isRestDay
            ? 'Domingo é folga. Hoje às 23h59 a semana fecha.'
            : `${daysLeftInWeek} ${daysLeftInWeek === 1 ? 'dia restante' : 'dias restantes'} · meta de ${group.weekly_goal} treinos`}
        </Txt>
      </View>

      <View style={{ gap: 16, paddingHorizontal: 16, paddingTop: 8 }}>
        <HomeAlerts />

        {weeks.data && results.data && <WeekResultBanner week={weeks.data[0]} results={results.data} />}

        {mine && mine.member.starts_on > monday && (
          <Card style={{ borderColor: alpha(colors.accent, 0.3), backgroundColor: alpha(colors.accent, 0.05) }}>
            <Txt size={14}>
              A meta começa a valer na <Txt size={14} weight="700">segunda, {dayMonth(mine.member.starts_on)}</Txt>. Até lá, os treinos já
              aparecem no feed, mas não há punição.
            </Txt>
          </Card>
        )}

        {isLoading || !board ? (
          <Spinner />
        ) : (
          <View style={{ gap: 12 }}>
            {board.map((mw) => (
              <ScoreCard
                key={mw.member.user_id}
                data={mw}
                color={memberColor(members.findIndex((m) => m.user_id === mw.member.user_id))}
                isMe={mw.member.user_id === userId}
              />
            ))}
          </View>
        )}

        <View style={{ paddingTop: 4 }}>
          {mine?.progress.trainedToday ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: alpha(colors.ok, 0.3),
                backgroundColor: alpha(colors.ok, 0.1),
                paddingVertical: 16,
              }}
            >
              <Txt weight="600" color={colors.ok} center>
                ✓ Treino de hoje registrado
              </Txt>
            </View>
          ) : needsGym && !isRestDay ? (
            <View style={{ gap: 8 }}>
              <Button onPress={() => router.push('/academias')} style={{ borderRadius: 16, paddingVertical: 20 }} textStyle={{ fontSize: 18 }}>
                📍 Cadastrar a minha academia
              </Button>
              <Txt size={12} muted center>
                Para registrar o treino, você precisa cadastrar a academia onde treina.
              </Txt>
            </View>
          ) : (
            <Button
              onPress={() => router.push('/check-in')}
              disabled={isRestDay || (group.require_location && gyms.isLoading)}
              style={{ borderRadius: 16, paddingVertical: 20 }}
              textStyle={{ fontSize: 18 }}
            >
              {isRestDay ? 'Domingo é folga' : '📸 Fiz meu treino'}
            </Button>
          )}
        </View>

        {mine && !mine.joker && jokerAvailable && (mine.progress.status === 'at_risk' || mine.progress.status === 'missed') && (
          <Pressable onPress={() => router.push('/excecoes')} accessibilityRole="link">
            <Card style={{ borderColor: alpha(colors.warn, 0.3), backgroundColor: alpha(colors.warn, 0.05) }}>
              <Txt size={14}>
                <Txt size={14} weight="700" color={colors.warn}>
                  Vai faltar?
                </Txt>{' '}
                Você ainda tem o coringa do mês. Ele cancela a punição desta semana. Ou marque uma exceção (doença, viagem, lesão,
                menstruação). ›
              </Txt>
            </Card>
          </Pressable>
        )}

        <TodayPlanCard />

        <ChallengeHomeCard />

        <Pressable onPress={() => router.push('/sequencia')} accessibilityRole="link">
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Txt size={14} muted>
                Sequência {members.length === 2 ? 'do casal' : 'do grupo'}
              </Txt>
              <Txt size={18} weight="600">
                🔥 {streak.current} {streak.current === 1 ? 'semana' : 'semanas'}
              </Txt>
            </View>
            <Txt size={14} muted>
              Recorde: {streak.best} ›
            </Txt>
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push('/historia')} accessibilityRole="link">
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt size={14} muted>
                Nossa história
              </Txt>
              <Txt size={18} weight="600">
                💑 {togetherThisMonth === 0 ? 'Nenhum treino juntos' : `Juntos ${togetherThisMonth} ${togetherThisMonth === 1 ? 'vez' : 'vezes'}`} em {monthName(today)}
              </Txt>
            </View>
            <Txt size={14} muted>
              Ver ›
            </Txt>
          </Card>
        </Pressable>
      </View>
    </ScrollView>
  )
}

function statusText(mw: MemberWeek): { text: string; tone: string } {
  const p = mw.progress
  switch (p.status) {
    case 'met':
      return { text: 'Meta batida 🎉', tone: colors.ok }
    case 'joker':
      return { text: '🃏 Coringa usado: sem punição nesta semana', tone: colors.warn }
    case 'missed':
      return { text: 'Não dá mais para bater a meta', tone: colors.danger }
    case 'at_risk':
      return { text: `Faltam ${p.missing} em ${p.daysLeft} ${p.daysLeft === 1 ? 'dia' : 'dias'}: não pode falhar`, tone: colors.warn }
    case 'not_started':
      return { text: `Meta começa ${dayMonth(mw.member.starts_on)}`, tone: colors.muted }
    default:
      return { text: `Faltam ${p.missing} em ${p.daysLeft} dias`, tone: colors.muted }
  }
}

function ScoreCard({ data, color, isMe }: { data: MemberWeek; color: string; isMe: boolean }) {
  const { monday, today, rules } = useGroup()
  const { member, progress } = data
  const status = statusText(data)
  const days = Array.from({ length: rules.sundayCounts ? 7 : 6 }, (_, i) => addDays(monday, i))
  const trained = new Set(data.checkins.map((c) => c.day))
  const justified = new Set(data.exceptions.map((e) => e.day))
  const pct = progress.goal === 0 ? 100 : Math.min(100, (progress.done / progress.goal) * 100)

  return (
    <Card style={isMe ? { borderColor: alpha(colors.accent, 0.4) } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={member.display_name} color={color} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="600" numberOfLines={1}>
            {member.display_name}
            {isMe && (
              <Txt size={12} muted>
                {' '}
                (você)
              </Txt>
            )}
          </Txt>
          <Txt size={12} color={status.tone}>
            {status.text}
          </Txt>
        </View>
        <Txt size={30} weight="700" style={{ fontVariant: ['tabular-nums'] }}>
          {progress.done}
          <Txt size={18} muted>
            /{progress.goal}
          </Txt>
        </Txt>
      </View>

      <View style={{ marginTop: 12, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.surface2 }}>
        <View style={{ height: '100%', width: `${pct}%`, borderRadius: 3, backgroundColor: color }} />
      </View>

      <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d) => {
          const isToday = d === today
          const did = trained.has(d)
          const exc = justified.has(d)
          return (
            <View key={d} style={{ alignItems: 'center', gap: 4 }}>
              <Txt size={10} color={isToday ? colors.ink : colors.muted} style={{ textTransform: 'uppercase' }}>
                {weekdayShort(d)}
              </Txt>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: did ? color : 'transparent',
                  borderWidth: did ? 0 : isToday ? 2 : 1,
                  borderColor: isToday && !did ? alpha(colors.ink, 0.4) : exc ? alpha(colors.warn, 0.6) : colors.line,
                }}
              >
                <Txt size={12} weight="700" color={did ? colors.bg : exc ? colors.warn : colors.muted}>
                  {did ? '✓' : exc ? 'E' : ''}
                </Txt>
              </View>
            </View>
          )
        })}
      </View>
    </Card>
  )
}

const SEEN_PREFIX = 'treino:semana-vista:'

function WeekResultBanner({ week, results }: { week: Week | undefined; results: WeekResult[] }) {
  const { nameOf } = useGroup()
  // null = ainda lendo do aparelho se a pessoa já dispensou este aviso.
  const [dismissed, setDismissed] = useState<boolean | null>(week ? null : true)

  useEffect(() => {
    if (!week) return setDismissed(true)
    let alive = true
    readLocal(SEEN_PREFIX + week.id).then((v) => alive && setDismissed(v === '1'))
    return () => {
      alive = false
    }
  }, [week])

  if (!week || dismissed !== false) return null

  const rows = results.filter((r) => r.week_id === week.id)
  const owing = rows.filter((r) => r.owes)
  const close = () => {
    void writeLocal(SEEN_PREFIX + week.id, '1')
    setDismissed(true)
  }

  return (
    <Card
      style={
        owing.length
          ? { borderColor: alpha(colors.danger, 0.4), backgroundColor: alpha(colors.danger, 0.05) }
          : { borderColor: alpha(colors.ok, 0.4), backgroundColor: alpha(colors.ok, 0.05) }
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Txt size={14} muted>
          Semana {weekRange(week.week_start)} fechada
        </Txt>
        <Pressable onPress={close} accessibilityLabel="Dispensar" hitSlop={10}>
          <Txt muted>✕</Txt>
        </Pressable>
      </View>
      {owing.length === 0 ? (
        <Txt size={18} weight="600" style={{ marginTop: 4 }}>
          Todo mundo cumpriu. Sem punição! 💪
        </Txt>
      ) : (
        <>
          <Txt size={18} weight="600" style={{ marginTop: 4 }}>
            {owing.map((r) => nameOf(r.user_id)).join(' e ')} {owing.length > 1 ? 'pagam' : 'paga'} {formatMoney(week.fine_amount ?? 0)}
          </Txt>
          {week.punishment_text && (
            <Txt size={14} style={{ marginTop: 4 }}>
              🎡 {owing.length > 1 ? 'E os dois:' : 'E mais:'} <Txt size={14} weight="700">{week.punishment_text}</Txt>
            </Txt>
          )}
          <Pressable
            onPress={() => {
              close()
              router.push('/caixinha')
            }}
            style={{ marginTop: 8 }}
            accessibilityRole="link"
          >
            <Txt size={14} color={colors.accent}>
              Ver caixinha ›
            </Txt>
          </Pressable>
        </>
      )}
      <View style={{ marginTop: 8, gap: 2 }}>
        {rows.map((r) => (
          <Txt key={r.user_id} size={12} muted>
            {nameOf(r.user_id)}: {r.checkins}/{r.goal} {r.met ? '✓' : r.used_joker ? '🃏 coringa' : '✗'}
          </Txt>
        ))}
      </View>
    </Card>
  )
}
