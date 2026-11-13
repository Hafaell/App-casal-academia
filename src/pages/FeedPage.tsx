import { useMemo, useState } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Avatar, Button, Card, EmptyState, PageHeader, PhotoViewer, Spinner, memberColor, useToast } from '@/components/ui'
import { useCheckins, useDeleteCheckin, useExceptions, useJokers, usePhotoUrls, useWeekResults, useWeeks } from '@/data/queries'
import type { Checkin, ExceptionDay, Joker, Week, WeekResult } from '@/data/types'
import { addDays, dayMonth, localDate, localTime, weekRange, weekdayShort } from '@/domain/dates'
import { EXCEPTION_REASONS, formatMoney } from '@/domain/rules'
import { errorMessage } from '@/lib/supabase'

type FeedItem =
  | { type: 'checkin'; at: string; data: Checkin }
  | { type: 'exception'; at: string; data: ExceptionDay }
  | { type: 'joker'; at: string; data: Joker }
  | { type: 'week'; at: string; data: Week }

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
  const photos = usePhotoUrls((checkins.data ?? []).map((c) => c.photo_path))
  const [viewing, setViewing] = useState<Checkin | null>(null)

  const items = useMemo<FeedItem[]>(() => {
    const list: FeedItem[] = [
      ...(checkins.data ?? []).map((c) => ({ type: 'checkin' as const, at: c.created_at, data: c })),
      ...(exceptions.data ?? []).map((e) => ({ type: 'exception' as const, at: e.created_at, data: e })),
      ...(jokers.data ?? []).filter((j) => j.week_start >= from).map((j) => ({ type: 'joker' as const, at: j.created_at, data: j })),
      ...(weeks.data ?? []).filter((w) => w.week_start >= from).map((w) => ({ type: 'week' as const, at: w.closed_at, data: w })),
    ]
    return list.sort((a, b) => b.at.localeCompare(a.at))
  }, [checkins.data, exceptions.data, jokers.data, weeks.data, from])

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
                    onOpen={() => setViewing(item.data)}
                  />
                )
              case 'exception':
                return <ExceptionCard key={`e-${item.data.id}`} exception={item.data} />
              case 'joker':
                return <JokerCard key={`j-${item.data.id}`} joker={item.data} />
              case 'week':
                return (
                  <WeekCard
                    key={`w-${item.data.id}`}
                    week={item.data}
                    results={(results.data ?? []).filter((r) => r.week_id === item.data.id)}
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
  return { name: nameOf(userId), color: memberColor(Math.max(0, idx)) }
}

function CheckinCard({ checkin, url, onOpen }: { checkin: Checkin; url?: string; onOpen: () => void }) {
  const { group, userId, today } = useGroup()
  const { name, color } = useMemberLook(checkin.user_id)
  const del = useDeleteCheckin()
  const toast = useToast()
  const canDelete = checkin.user_id === userId && checkin.day === today

  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-3 p-3">
        <Avatar name={name} color={color} size={32} />
        <div className="flex-1">
          <p className="text-sm font-semibold">{name} treinou 💪</p>
          <p className="text-xs text-muted">
            {weekdayShort(checkin.day)} {dayMonth(checkin.day)} · {localTime(checkin.created_at, group.timezone)}
          </p>
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
      </div>
      <button className="block aspect-[4/5] w-full bg-surface-2" onClick={onOpen} aria-label={`Ver foto de ${name}`}>
        {url ? <img src={url} alt={`Check-in de ${name}`} loading="lazy" className="h-full w-full object-cover" /> : null}
      </button>
    </Card>
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

function WeekCard({ week, results }: { week: Week; results: WeekResult[] }) {
  const { nameOf } = useGroup()
  const owing = results.filter((r) => r.owes)
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
    </Card>
  )
}
