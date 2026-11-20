import { useMemo, useState } from 'react'
import { FlatList, Image, Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Avatar, Button, Card, EmptyState, Input, PageHeader, PhotoViewer, Sheet, Spinner, Txt, confirmAsync, memberColor, useToast } from '@/components/ui'
import { formatDistance } from '@domain/geo'
import { useCheckins, useDeleteCheckin, useExceptions, useJokers, usePhotoUrls, useReact, useReactions, useReportCheckin, useReports, useWeekResults, useWeeks } from '@/data/queries'
import type { Checkin, CheckinReport, ExceptionDay, Joker, Reaction, Week, WeekResult } from '@/data/types'
import { addDays, dayMonth, localDate, localTime, mondayOf, weekRange, weekdayShort } from '@domain/dates'
import { CHECKIN_KINDS, REACTION_EMOJIS, summarizeReactions, type ReactionEmoji } from '@domain/reactions'
import { findTogether } from '@domain/together'
import { EXCEPTION_REASONS, formatMoney } from '@domain/rules'
import { buildSummaryCard, shareImage, type SummaryCard } from '@/lib/summaryCard'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

type FeedItem =
  | { type: 'checkin'; at: string; data: Checkin }
  | { type: 'exception'; at: string; data: ExceptionDay }
  | { type: 'joker'; at: string; data: Joker }
  | { type: 'week'; at: string; data: Week }
  | { type: 'report'; at: string; data: CheckinReport }

const PAGE_DAYS = 45

export function FeedScreen() {
  const { group, today } = useGroup()
  const [days, setDays] = useState(PAGE_DAYS)
  const from = addDays(today, -days)
  const to = addDays(today, 70)
  const checkins = useCheckins(group.id, from, today)
  const exceptions = useExceptions(group.id, from, to)
  const jokers = useJokers(group.id)
  const weeks = useWeeks(group.id)
  const results = useWeekResults(group.id)
  const reports = useReports(group.id, from)
  const photos = usePhotoUrls([...(checkins.data ?? []).map((c) => c.photo_path), ...(reports.data ?? []).map((r) => r.photo_path)])
  const reactions = useReactions(group.id, (checkins.data ?? []).map((c) => c.id))
  const together = useMemo(() => findTogether(checkins.data ?? []).checkinIds, [checkins.data])
  const [viewing, setViewing] = useState<Checkin | null>(null)
  const [reporting, setReporting] = useState<Checkin | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const items = useMemo<FeedItem[]>(() => {
    const list: FeedItem[] = [
      ...(checkins.data ?? []).map((c) => ({ type: 'checkin' as const, at: c.created_at, data: c })),
      ...(exceptions.data ?? []).map((e) => ({ type: 'exception' as const, at: e.created_at, data: e })),
      ...(jokers.data ?? []).filter((j) => j.week_start >= from).map((j) => ({ type: 'joker' as const, at: j.created_at, data: j })),
      ...(weeks.data ?? []).filter((w) => w.week_start >= from).map((w) => ({ type: 'week' as const, at: w.closed_at, data: w })),
      ...(reports.data ?? []).map((r) => ({ type: 'report' as const, at: r.created_at, data: r })),
    ]
    return list.sort((a, b) => b.at.localeCompare(a.at))
  }, [checkins.data, exceptions.data, jokers.data, weeks.data, reports.data, from])

  const loading = checkins.isLoading || exceptions.isLoading

  async function refresh() {
    setRefreshing(true)
    await Promise.all([checkins.refetch(), exceptions.refetch(), jokers.refetch(), weeks.refetch(), results.refetch(), reports.refetch()])
    setRefreshing(false)
  }

  function renderItem({ item }: { item: FeedItem }) {
    switch (item.type) {
      case 'checkin':
        return (
          <CheckinCard
            checkin={item.data}
            url={photos.data?.get(item.data.photo_path)}
            reactions={(reactions.data ?? []).filter((r) => r.checkin_id === item.data.id)}
            together={together.has(item.data.id)}
            canReport={!(weeks.data ?? []).some((w) => w.week_start === mondayOf(item.data.day))}
            onReport={() => setReporting(item.data)}
            onOpen={() => setViewing(item.data)}
          />
        )
      case 'exception':
        return <ExceptionCard exception={item.data} />
      case 'report':
        return <ReportCard report={item.data} url={photos.data?.get(item.data.photo_path)} />
      case 'joker':
        return <JokerCard joker={item.data} />
      case 'week':
        return (
          <WeekCard
            week={item.data}
            results={(results.data ?? []).filter((r) => r.week_id === item.data.id)}
            checkins={checkins.data ?? []}
            photoUrls={photos.data}
          />
        )
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader title="Feed" subtitle="Tudo que o grupo registrou" />
      {loading ? (
        <Spinner />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type[0]}-${item.data.id}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshing={refreshing}
          onRefresh={refresh}
          ListEmptyComponent={<EmptyState>Nenhum treino ainda. O primeiro check-in aparece aqui.</EmptyState>}
          ListFooterComponent={
            <Button variant="ghost" onPress={() => setDays((d) => d + PAGE_DAYS)}>
              Ver mais antigos
            </Button>
          }
        />
      )}
      <ReportSheet checkin={reporting} onClose={() => setReporting(null)} />
      <PhotoViewer url={viewing ? (photos.data?.get(viewing.photo_path) ?? null) : null} onClose={() => setViewing(null)} />
    </View>
  )
}

function useMemberLook(userId: string) {
  const { members, nameOf } = useGroup()
  const idx = members.findIndex((m) => m.user_id === userId)
  return { name: nameOf(userId), color: memberColor(idx) }
}

function CheckinCard({
  checkin,
  url,
  reactions,
  together,
  canReport,
  onReport,
  onOpen,
}: {
  checkin: Checkin
  url?: string
  reactions: Reaction[]
  together?: boolean
  canReport: boolean
  onReport: () => void
  onOpen: () => void
}) {
  const { group, userId, today } = useGroup()
  const { name, color } = useMemberLook(checkin.user_id)
  const del = useDeleteCheckin()
  const toast = useToast()
  const canDelete = checkin.user_id === userId && checkin.day === today

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: color }}>
        <Avatar name={name} color={color} size={32} />
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="600">
            {name} treinou 💪
          </Txt>
          <Txt size={12} muted>
            {weekdayShort(checkin.day)} {dayMonth(checkin.day)} · {localTime(checkin.created_at, group.timezone)}
          </Txt>
          {checkin.gym_name && (
            <Txt size={12} muted>
              📍 {checkin.gym_name}
              {checkin.distance_m !== null && ` · ${formatDistance(checkin.distance_m)}`}
            </Txt>
          )}
          {checkin.kind && (
            <Txt size={12} muted>
              🏷️ {CHECKIN_KINDS[checkin.kind]}
            </Txt>
          )}
          {together && (
            <Txt size={12} weight="600" color={colors.accent}>
              💑 Treinaram juntos
            </Txt>
          )}
        </View>
        {canDelete && (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            onPress={async () => {
              if (!(await confirmAsync('Apagar o check-in de hoje? A foto também será apagada.', 'Apagar', true))) return
              del.mutate(checkin, { onError: (err) => toast(errorMessage(err), 'error') })
            }}
          >
            <Txt size={12} muted>
              Apagar
            </Txt>
          </Pressable>
        )}
        {!canDelete && checkin.user_id !== userId && canReport && (
          <Pressable hitSlop={8} accessibilityRole="button" onPress={onReport}>
            <Txt size={12} muted>
              🚩 Reportar
            </Txt>
          </Pressable>
        )}
      </View>
      <Pressable onPress={onOpen} accessibilityLabel={`Ver foto de ${name}`} style={{ aspectRatio: 4 / 5, width: '100%', backgroundColor: colors.surface2 }}>
        {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`Check-in de ${name}`} /> : null}
      </Pressable>
      <ReactionBar checkinId={checkin.id} reactions={reactions} />
    </Card>
  )
}

/** Um emoji por pessoa: tocar de novo no mesmo tira, tocar em outro troca. */
function ReactionBar({ checkinId, reactions }: { checkinId: string; reactions: Reaction[] }) {
  const { userId } = useGroup()
  const react = useReact(userId)
  const toast = useToast()
  const { counts, mine } = summarizeReactions(reactions, userId)
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
      {REACTION_EMOJIS.map((emoji: ReactionEmoji) => {
        const n = counts.get(emoji) ?? 0
        const active = mine?.emoji === emoji
        return (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: react.isPending }}
            disabled={react.isPending}
            onPress={() => react.mutate({ checkinId, emoji, mine }, { onError: (err) => toast(errorMessage(err), 'error') })}
            style={({ pressed }) => ({
              minHeight: 36,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              borderColor: active ? colors.accent : colors.line,
              backgroundColor: active ? alpha(colors.accent, 0.15) : colors.surface2,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Txt size={14}>{emoji}</Txt>
            {n > 0 && (
              <Txt size={12} muted style={{ fontVariant: ['tabular-nums'] }}>
                {n}
              </Txt>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

/** Treino cancelado por outro membro: fica o aviso, o motivo e a foto. */
function ReportCard({ report, url }: { report: CheckinReport; url?: string }) {
  const { nameOf } = useGroup()
  return (
    <Card style={{ borderColor: alpha(colors.danger, 0.3), backgroundColor: alpha(colors.danger, 0.05) }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {url && <Image source={{ uri: url }} style={{ width: 48, height: 64, borderRadius: 8, opacity: 0.6 }} resizeMode="cover" />}
        <View style={{ flex: 1 }}>
          <Txt size={14}>
            🚩 O treino de <Txt size={14} weight="700">{report.author_id ? nameOf(report.author_id) : 'alguém'}</Txt> de {weekdayShort(report.day)}{' '}
            {dayMonth(report.day)} foi cancelado por <Txt size={14} weight="700">{report.reporter_id ? nameOf(report.reporter_id) : 'um membro'}</Txt>.
          </Txt>
          <Txt size={14} muted>
            Motivo: “{report.reason}”
          </Txt>
          <Txt size={12} muted>
            Esse dia não contou para a meta.
          </Txt>
        </View>
      </View>
    </Card>
  )
}

/** Pergunta o motivo antes de cancelar o treino de outra pessoa. */
function ReportSheet({ checkin, onClose }: { checkin: Checkin | null; onClose: () => void }) {
  const { nameOf } = useGroup()
  const report = useReportCheckin()
  const toast = useToast()
  const [reason, setReason] = useState('')

  const submit = () => {
    if (!checkin) return
    report.mutate(
      { checkinId: checkin.id, reason },
      {
        onSuccess: () => {
          toast('Treino cancelado')
          setReason('')
          onClose()
        },
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    )
  }

  return (
    <Sheet open={Boolean(checkin)} onClose={onClose}>
      {checkin && (
        <View style={{ gap: 12 }}>
          <Txt size={18} weight="600">
            Reportar este treino
          </Txt>
          <Txt size={14} muted>
            O treino de <Txt size={14} weight="700">{nameOf(checkin.user_id)}</Txt> será <Txt size={14} weight="700">cancelado</Txt> e deixa de contar na
            meta da semana. O grupo todo vê quem reportou e o motivo.
          </Txt>
          <Input
            multiline
            maxLength={200}
            placeholder="Motivo (ex.: a foto não foi tirada na academia)"
            value={reason}
            onChangeText={setReason}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="ghost" onPress={onClose}>
              Voltar
            </Button>
            <Button variant="danger" style={{ flex: 1 }} onPress={submit} loading={report.isPending} disabled={!reason.trim()}>
              Cancelar este treino
            </Button>
          </View>
        </View>
      )}
    </Sheet>
  )
}

function ExceptionCard({ exception }: { exception: ExceptionDay }) {
  const { group } = useGroup()
  const { name, color } = useMemberLook(exception.user_id)
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <Avatar name={name} color={color} size={32} />
      <View style={{ flex: 1 }}>
        <Txt size={14}>
          <Txt size={14} weight="700">
            {name}
          </Txt>{' '}
          justificou {weekdayShort(exception.day)} {dayMonth(exception.day)}:{' '}
          <Txt size={14} color={colors.warn}>
            {EXCEPTION_REASONS[exception.reason]}
          </Txt>
        </Txt>
        {exception.note && (
          <Txt size={14} muted>
            “{exception.note}”
          </Txt>
        )}
        <Txt size={12} muted>
          marcado em {dayMonth(localDate(exception.created_at, group.timezone))}
        </Txt>
      </View>
    </Card>
  )
}

function JokerCard({ joker }: { joker: Joker }) {
  const { name, color } = useMemberLook(joker.user_id)
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <Avatar name={name} color={color} size={32} />
      <Txt size={14} style={{ flex: 1 }}>
        🃏 <Txt size={14} weight="700">{name}</Txt> usou o coringa na semana {weekRange(joker.week_start)}
      </Txt>
    </Card>
  )
}

function WeekCard({
  week,
  results,
  checkins,
  photoUrls,
}: {
  week: Week
  results: WeekResult[]
  checkins: Checkin[]
  photoUrls?: Map<string, string>
}) {
  const { nameOf, members } = useGroup()
  const toast = useToast()
  const [sharing, setSharing] = useState(false)
  const [card, setCard] = useState<SummaryCard | null>(null)
  const [viewingCard, setViewingCard] = useState(false)
  const owing = results.filter((r) => r.owes)

  // Toque 1: monta a imagem (demora, por causa das fotos). Toque 2: compartilha.
  async function prepare() {
    setSharing(true)
    try {
      const end = addDays(week.week_start, 6)
      const photos = checkins
        .filter((c) => c.day >= week.week_start && c.day <= end)
        .map((c) => photoUrls?.get(c.photo_path))
        .filter((u): u is string => Boolean(u))
      setCard(
        await buildSummaryCard({
          title: 'Treino a Dois',
          subtitle: `Semana ${weekRange(week.week_start)}`,
          photos,
          lines: results.map((r) => ({
            name: nameOf(r.user_id),
            color: memberColor(members.findIndex((m) => m.user_id === r.user_id)),
            text: `${r.checkins}/${r.goal}${r.met ? ' ✓' : r.used_joker ? ' 🃏' : ''}`,
          })),
          footer: owing.length === 0 ? 'Ninguém foi punido 💪' : `Caixinha: ${formatMoney(week.fine_amount ?? 0)}`,
        }),
      )
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSharing(false)
    }
  }

  async function share() {
    if (!card) return
    try {
      if (!(await shareImage(card))) setViewingCard(true)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <Card style={{ borderColor: owing.length ? alpha(colors.danger, 0.3) : alpha(colors.ok, 0.3) }}>
      <Txt size={12} muted>
        Semana {weekRange(week.week_start)} fechada
      </Txt>
      {owing.length === 0 ? (
        <Txt weight="600">Ninguém foi punido 💪</Txt>
      ) : (
        <Txt weight="600">
          {owing.map((r) => nameOf(r.user_id)).join(' e ')}: {formatMoney(week.fine_amount ?? 0)}
          {week.punishment_text ? ` + ${week.punishment_text}` : ''}
        </Txt>
      )}
      <Txt size={12} muted style={{ marginTop: 4 }}>
        {results.map((r) => `${nameOf(r.user_id)} ${r.checkins}/${r.goal}${r.used_joker ? ' 🃏' : ''}`).join(' · ')}
      </Txt>
      <Button variant="ghost" style={{ marginTop: 8 }} textStyle={{ color: colors.accent }} onPress={card ? share : prepare} loading={sharing}>
        {sharing ? 'Preparando…' : card ? '📤 Compartilhar' : '🖼️ Montar cartão da semana'}
      </Button>
      <PhotoViewer url={viewingCard ? (card?.uri ?? null) : null} caption="Imagem da semana" onClose={() => setViewingCard(false)} />
    </Card>
  )
}
