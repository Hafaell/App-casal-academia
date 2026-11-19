import { useMemo, useState } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Avatar, Button, Card, EmptyState, PageHeader, PhotoViewer, Sheet, Spinner, inputClass, memberColor, useToast } from '@/components/ui'
import { formatDistance } from '@/domain/geo'
import { useCheckins, useDeleteCheckin, useExceptions, useJokers, usePhotoUrls, useReact, useReactions, useReportCheckin, useReports, useWeekResults, useWeeks } from '@/data/queries'
import type { Checkin, CheckinReport, ExceptionDay, Joker, Reaction, Week, WeekResult } from '@/data/types'
import { addDays, dayMonth, localDate, localTime, mondayOf, weekRange, weekdayShort } from '@/domain/dates'
import { CHECKIN_KINDS, REACTION_EMOJIS, summarizeReactions, type ReactionEmoji } from '@/domain/reactions'
import { EXCEPTION_REASONS, formatMoney } from '@/domain/rules'
import { buildSummaryCard, shareImage } from '@/lib/summaryCard'
import { errorMessage } from '@/lib/supabase'

type FeedItem =
  | { type: 'checkin'; at: string; data: Checkin }
  | { type: 'exception'; at: string; data: ExceptionDay }
  | { type: 'joker'; at: string; data: Joker }
  | { type: 'week'; at: string; data: Week }
  | { type: 'report'; at: string; data: CheckinReport }

const PAGE_DAYS = 45

export function FeedPage() {
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
  const [viewing, setViewing] = useState<Checkin | null>(null)
  const [reporting, setReporting] = useState<Checkin | null>(null)

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

  return (
    <div>
      <PageHeader title="Feed" subtitle="Tudo que o grupo registrou" />
      <div className="space-y-3 px-4 pt-4">
        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState>Nenhum treino ainda. O primeiro check-in aparece aqui.</EmptyState>
        ) : (
          items.map((item) => {
            switch (item.type) {
              case 'checkin':
                return (
                  <CheckinCard
                    key={`c-${item.data.id}`}
                    checkin={item.data}
                    url={photos.data?.get(item.data.photo_path)}
                    reactions={(reactions.data ?? []).filter((r) => r.checkin_id === item.data.id)}
                    canReport={!(weeks.data ?? []).some((w) => w.week_start === mondayOf(item.data.day))}
                    onReport={() => setReporting(item.data)}
                    onOpen={() => setViewing(item.data)}
                  />
                )
              case 'exception':
                return <ExceptionCard key={`e-${item.data.id}`} exception={item.data} />
              case 'report':
                return <ReportCard key={`r-${item.data.id}`} report={item.data} url={photos.data?.get(item.data.photo_path)} />
              case 'joker':
                return <JokerCard key={`j-${item.data.id}`} joker={item.data} />
              case 'week':
                return (
                  <WeekCard
                    key={`w-${item.data.id}`}
                    week={item.data}
                    results={(results.data ?? []).filter((r) => r.week_id === item.data.id)}
                    checkins={checkins.data ?? []}
                    photoUrls={photos.data}
                  />
                )
            }
          })
        )}
        {!loading && (
          <Button variant="ghost" className="w-full" onClick={() => setDays((d) => d + PAGE_DAYS)}>
            Ver mais antigos
          </Button>
        )}
      </div>
      <ReportSheet checkin={reporting} onClose={() => setReporting(null)} />
      <PhotoViewer
        url={viewing ? (photos.data?.get(viewing.photo_path) ?? null) : null}
        onClose={() => setViewing(null)}
      />
    </div>
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
  canReport,
  onReport,
  onOpen,
}: {
  checkin: Checkin
  url?: string
  reactions: Reaction[]
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
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-3 border-l-4 p-3" style={{ borderColor: color }}>
        <Avatar name={name} color={color} size={32} />
        <div className="flex-1">
          <p className="text-sm font-semibold">{name} treinou 💪</p>
          <p className="text-xs text-muted">
            {weekdayShort(checkin.day)} {dayMonth(checkin.day)} · {localTime(checkin.created_at, group.timezone)}
          </p>
          {checkin.gym_name && (
            <p className="text-xs text-muted">
              📍 {checkin.gym_name}
              {checkin.distance_m !== null && ` · ${formatDistance(checkin.distance_m)}`}
            </p>
          )}
          {checkin.kind && <p className="text-xs text-muted">🏷️ {CHECKIN_KINDS[checkin.kind]}</p>}
        </div>
        {canDelete && (
          <button
            className="text-xs text-muted"
            onClick={() => {
              if (!confirm('Apagar o check-in de hoje? A foto também será apagada.')) return
              del.mutate(checkin, { onError: (err) => toast(errorMessage(err), 'error') })
            }}
          >
            Apagar
          </button>
        )}
        {!canDelete && checkin.user_id !== userId && canReport && (
          <button className="text-xs text-muted" onClick={onReport}>
            🚩 Reportar
          </button>
        )}
      </div>
      <button className="block aspect-[4/5] w-full bg-surface-2" onClick={onOpen} aria-label={`Ver foto de ${name}`}>
        {url ? <img src={url} alt={`Check-in de ${name}`} loading="lazy" className="h-full w-full object-cover" /> : null}
      </button>
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
    <div className="flex gap-2 p-2">
      {REACTION_EMOJIS.map((emoji: ReactionEmoji) => {
        const n = counts.get(emoji) ?? 0
        const active = mine?.emoji === emoji
        return (
          <button
            key={emoji}
            aria-pressed={active}
            disabled={react.isPending}
            onClick={() => react.mutate({ checkinId, emoji, mine }, { onError: (err) => toast(errorMessage(err), 'error') })}
            className={`flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm transition active:scale-95 ${
              active ? 'border-accent bg-accent/15' : 'border-line bg-surface-2'
            }`}
          >
            <span>{emoji}</span>
            {n > 0 && <span className="text-xs tabular-nums text-muted">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Treino cancelado por outro membro: fica o aviso, o motivo e a foto. */
function ReportCard({ report, url }: { report: CheckinReport; url?: string }) {
  const { nameOf } = useGroup()
  return (
    <Card className="border-danger/30 bg-danger/5">
      <div className="flex items-start gap-3">
        {url && <img src={url} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded-lg object-cover opacity-60 grayscale" />}
        <div className="text-sm">
          <p>
            🚩 O treino de <b>{report.author_id ? nameOf(report.author_id) : 'alguém'}</b> de {weekdayShort(report.day)} {dayMonth(report.day)} foi
            cancelado por <b>{report.reporter_id ? nameOf(report.reporter_id) : 'um membro'}</b>.
          </p>
          <p className="text-muted">Motivo: “{report.reason}”</p>
          <p className="text-xs text-muted">Esse dia não contou para a meta.</p>
        </div>
      </div>
    </Card>
  )
}

/** Pergunta o motivo antes de cancelar o treino de outra pessoa. */
function ReportSheet({ checkin, onClose }: { checkin: Checkin | null; onClose: () => void }) {
  const { nameOf } = useGroup()
  const report = useReportCheckin()
  const toast = useToast()
  const [reason, setReason] = useState('')

  if (!checkin) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  const submit = () =>
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

  return (
    <Sheet open onClose={onClose}>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Reportar este treino</h3>
        <p className="text-sm text-muted">
          O treino de <b className="text-ink">{nameOf(checkin.user_id)}</b> será <b className="text-ink">cancelado</b> e deixa de contar
          na meta da semana. O grupo todo vê quem reportou e o motivo.
        </p>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={200}
          placeholder="Motivo (ex.: a foto não foi tirada na academia)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="danger" className="flex-1" onClick={submit} loading={report.isPending} disabled={!reason.trim()}>
            Cancelar este treino
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

function ExceptionCard({ exception }: { exception: ExceptionDay }) {
  const { group } = useGroup()
  const { name, color } = useMemberLook(exception.user_id)
  return (
    <Card className="flex items-center gap-3 !py-3">
      <Avatar name={name} color={color} size={32} />
      <div className="text-sm">
        <p>
          <b>{name}</b> justificou {weekdayShort(exception.day)} {dayMonth(exception.day)}:{' '}
          <span className="text-warn">{EXCEPTION_REASONS[exception.reason]}</span>
        </p>
        {exception.note && <p className="text-muted">“{exception.note}”</p>}
        <p className="text-xs text-muted">
          marcado em {dayMonth(localDate(exception.created_at, group.timezone))}
        </p>
      </div>
    </Card>
  )
}

function JokerCard({ joker }: { joker: Joker }) {
  const { name, color } = useMemberLook(joker.user_id)
  return (
    <Card className="flex items-center gap-3 !py-3">
      <Avatar name={name} color={color} size={32} />
      <p className="text-sm">
        🃏 <b>{name}</b> usou o coringa na semana {weekRange(joker.week_start)}
      </p>
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
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null)
  const [viewingCard, setViewingCard] = useState(false)
  const owing = results.filter((r) => r.owes)

  // Toque 1: monta a imagem (demora, por causa das fotos). Toque 2: compartilha na hora.
  async function prepare() {
    setSharing(true)
    try {
      const end = addDays(week.week_start, 6)
      const photos = checkins
        .filter((c) => c.day >= week.week_start && c.day <= end)
        .map((c) => photoUrls?.get(c.photo_path))
        .filter((u): u is string => Boolean(u))
      const blob = await buildSummaryCard({
        title: 'Treino a Dois',
        subtitle: `Semana ${weekRange(week.week_start)}`,
        photos,
        lines: results.map((r) => ({
          name: nameOf(r.user_id),
          color: memberColor(members.findIndex((m) => m.user_id === r.user_id)),
          text: `${r.checkins}/${r.goal}${r.met ? ' ✓' : r.used_joker ? ' 🃏' : ''}`,
        })),
        footer: owing.length === 0 ? 'Ninguém foi punido 💪' : `Caixinha: ${formatMoney(week.fine_amount ?? 0)}`,
      })
      setCard({ blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSharing(false)
    }
  }

  async function share() {
    if (!card) return
    try {
      if (!(await shareImage(card.blob, `semana-${week.week_start}.jpg`))) setViewingCard(true)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }
  return (
    <Card className={owing.length ? 'border-danger/30' : 'border-ok/30'}>
      <p className="text-xs text-muted">Semana {weekRange(week.week_start)} fechada</p>
      {owing.length === 0 ? (
        <p className="font-semibold">Ninguém foi punido 💪</p>
      ) : (
        <p className="font-semibold">
          {owing.map((r) => nameOf(r.user_id)).join(' e ')}: {formatMoney(week.fine_amount ?? 0)}
          {week.punishment_text ? ` + ${week.punishment_text}` : ''}
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        {results.map((r) => `${nameOf(r.user_id)} ${r.checkins}/${r.goal}${r.used_joker ? ' 🃏' : ''}`).join(' · ')}
      </p>
      <Button variant="ghost" className="mt-2 w-full !text-accent" onClick={card ? share : prepare} loading={sharing}>
        {sharing ? 'Preparando…' : card ? '📤 Compartilhar' : '🖼️ Montar cartão da semana'}
      </Button>
      <PhotoViewer
        url={viewingCard ? (card?.url ?? null) : null}
        caption="Segure a imagem para salvar ou compartilhar"
        onClose={() => setViewingCard(false)}
      />
    </Card>
  )
}
