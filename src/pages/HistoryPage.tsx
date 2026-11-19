import { useMemo, useState } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Card, EmptyState, PageHeader, PhotoViewer, Sheet, Spinner, cx, memberColor } from '@/components/ui'
import { useCheckins, useExceptions, usePhotoUrls, useWeekResults, useWeeks } from '@/data/queries'
import type { Checkin } from '@/data/types'
import {
  addDays,
  addMonths,
  daysInMonth,
  firstOfMonth,
  isoDow,
  localTime,
  monthLabel,
  mondayOf,
  weekRange,
  weekdayLong,
  dayMonth,
} from '@/domain/dates'
import { EXCEPTION_REASONS, formatMoney } from '@/domain/rules'

const WEEK_HEADER = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

export function HistoryPage() {
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

  return (
    <div>
      <PageHeader title="Histórico" />
      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <button className="h-10 w-10 rounded-full bg-surface text-lg" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
            ‹
          </button>
          <h2 className="font-semibold">{monthLabel(month)}</h2>
          <button
            className="h-10 w-10 rounded-full bg-surface text-lg disabled:opacity-30"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={month >= firstOfMonth(today)}
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {members.map((m, i) => (
            <span key={m.user_id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: memberColor(i) }} />
              {m.display_name}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-warn" /> exceção
          </span>
        </div>

        {checkins.isLoading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {WEEK_HEADER.map((h, i) => (
              <div key={i} className="pb-1 text-center text-[11px] text-muted">
                {h}
              </div>
            ))}
            {days.map((d) => {
              const list = byDay.get(d) ?? []
              const exc = (exceptions.data ?? []).filter((e) => e.day === d)
              const inMonth = d >= month && d <= lastOfMonth
              const thumb = list[0] ? photos.data?.get(list[0].photo_path) : undefined
              return (
                <button
                  key={d}
                  onClick={() => (list.length || exc.length ? setOpenDay(d) : undefined)}
                  className={cx(
                    'relative aspect-square overflow-hidden rounded-lg border text-left',
                    inMonth ? 'border-line bg-surface' : 'border-transparent bg-surface/40 opacity-40',
                    d === today && 'ring-2 ring-accent',
                    isoDow(d) === 7 && !group.sunday_counts && 'bg-surface/50',
                  )}
                >
                  {thumb && <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" loading="lazy" />}
                  <span className="relative ml-1 text-[11px] font-semibold drop-shadow">{Number(d.slice(8))}</span>
                  {list.length > 0 && (
                    <span className="absolute inset-x-0 bottom-0 flex h-1">
                      {list.map((c) => (
                        <span key={c.id} className="flex-1" style={{ background: colorOf(c.user_id) }} />
                      ))}
                    </span>
                  )}
                  <span className="absolute bottom-2 left-1 flex gap-0.5">
                    {list.map((c) => (
                      <span key={c.id} className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ background: colorOf(c.user_id) }} />
                    ))}
                    {exc.map((e) => (
                      <span key={e.id} className="h-2 w-2 rounded-full border border-warn" />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <h2 className="pt-2 font-semibold">Semanas</h2>
        {monthWeeks.length === 0 ? (
          <EmptyState>Nenhuma semana fechada neste mês ainda.</EmptyState>
        ) : (
          monthWeeks.map((w) => {
            const rows = (results.data ?? []).filter((r) => r.week_id === w.id)
            const owing = rows.filter((r) => r.owes)
            return (
              <Card key={w.id}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{weekRange(w.week_start)}</p>
                  <span className={cx('text-xs font-semibold', owing.length ? 'text-danger' : 'text-ok')}>
                    {owing.length ? 'Teve punição' : 'Todos cumpriram'}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {rows.map((r) => (
                    <li key={r.user_id} className="flex justify-between">
                      <span>{nameOf(r.user_id)}</span>
                      <span className="tabular-nums text-muted">
                        {r.checkins}/{r.goal}
                        {r.exception_days > 0 && ` (−${r.exception_days} exc.)`} {r.met ? '✓' : r.used_joker ? '🃏' : '✗'}
                      </span>
                    </li>
                  ))}
                </ul>
                {owing.length > 0 && (
                  <p className="mt-2 border-t border-line pt-2 text-sm">
                    {formatMoney(w.fine_amount ?? 0)}
                    {w.punishment_text && <> + {w.punishment_text}</>}
                  </p>
                )}
              </Card>
            )
          })
        )}
      </div>

      <Sheet open={Boolean(openDay)} onClose={() => setOpenDay(null)}>
        {openDay && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold capitalize">
              {weekdayLong(openDay)}, {dayMonth(openDay)}
            </h3>
            {dayExceptions.map((e) => (
              <p key={e.id} className="text-sm">
                <b>{nameOf(e.user_id)}</b>: <span className="text-warn">{EXCEPTION_REASONS[e.reason]}</span>
                {e.note && <span className="text-muted"> · {e.note}</span>}
              </p>
            ))}
            <div className="grid grid-cols-2 gap-2">
              {dayCheckins.map((c) => {
                const url = photos.data?.get(c.photo_path)
                return (
                  <button
                    key={c.id}
                    className="overflow-hidden rounded-xl border-2 bg-surface-2 text-left"
                    style={{ borderColor: colorOf(c.user_id) }}
                    onClick={() => url && setViewing(url)}
                  >
                    {url && <img src={url} alt="" className="aspect-[4/5] w-full object-cover" />}
                    <p className="px-2 py-1.5 text-xs">
                      {nameOf(c.user_id)} · {localTime(c.created_at, group.timezone)}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Sheet>
      <PhotoViewer url={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
