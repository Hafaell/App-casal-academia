import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useGroup } from '@/app/GroupProvider'
import { Avatar, Button, Card, Spinner, cx, memberColor } from '@/components/ui'
import { useGyms, useWeekResults, useWeeks } from '@/data/queries'
import { useWeekBoard, type MemberWeek } from '@/data/useWeekBoard'
import type { Week, WeekResult } from '@/data/types'
import { addDays, dayMonth, isoDow, monthKey, weekRange, weekdayLong, weekdayShort } from '@/domain/dates'
import { formatMoney } from '@/domain/rules'
import { groupStreak } from '@/domain/streak'

export function HomePage() {
  const { group, members, userId, today, monday, rules } = useGroup()
  const { board, jokers, isLoading } = useWeekBoard()
  const weeks = useWeeks(group.id)
  const results = useWeekResults(group.id)
  const gyms = useGyms(group.id)
  const navigate = useNavigate()

  // Com a regra de localização ligada, o treino só vale perto de uma academia cadastrada.
  const needsGym = group.require_location && gyms.isSuccess && gyms.data.length === 0

  const lastDow = rules.sundayCounts ? 7 : 6
  const daysLeftInWeek = Math.max(0, lastDow - isoDow(today) + 1)
  const isRestDay = isoDow(today) === 7 && !rules.sundayCounts

  const mine = board?.find((b) => b.member.user_id === userId)
  const jokerAvailable =
    (jokers ?? []).filter((j) => j.user_id === userId && monthKey(j.week_start) === monthKey(monday)).length <
    group.jokers_per_month

  const streak = useMemo(
    () =>
      groupStreak(
        (results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker })),
      ),
    [results.data],
  )

  return (
    <div>
      <header className="safe-top px-4 pb-2">
        <p className="text-sm text-muted">{group.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">Semana {weekRange(monday)}</h1>
        <p className="text-sm text-muted">
          {isRestDay
            ? 'Domingo é folga. Hoje às 23h59 a semana fecha.'
            : `${daysLeftInWeek} ${daysLeftInWeek === 1 ? 'dia restante' : 'dias restantes'} · meta de ${group.weekly_goal} treinos`}
        </p>
      </header>

      <div className="space-y-4 px-4 pt-2">
        {weeks.data && results.data && (
          <WeekResultBanner week={weeks.data[0]} results={results.data} />
        )}

        {mine && mine.member.starts_on > monday && (
          <Card className="border-accent/30 bg-accent/5 text-sm">
            A meta começa a valer na <b>segunda, {dayMonth(mine.member.starts_on)}</b>. Até lá, os treinos já aparecem
            no feed, mas não há punição.
          </Card>
        )}

        {isLoading || !board ? (
          <Spinner />
        ) : (
          <div className="grid gap-3">
            {board.map((mw) => (
              <ScoreCard
                key={mw.member.user_id}
                data={mw}
                color={memberColor(members.findIndex((m) => m.user_id === mw.member.user_id))}
                isMe={mw.member.user_id === userId}
              />
            ))}
          </div>
        )}

        <div className="pt-1">
          {mine?.progress.trainedToday ? (
            <div className="rounded-2xl border border-ok/30 bg-ok/10 py-4 text-center font-semibold text-ok">
              ✓ Treino de hoje registrado
            </div>
          ) : needsGym && !isRestDay ? (
            <div className="space-y-2">
              <Button className="w-full !rounded-2xl !py-5 text-lg" onClick={() => navigate('/academias')}>
                📍 Cadastrar uma academia
              </Button>
              <p className="text-center text-xs text-muted">
                Para registrar o treino, o grupo precisa ter uma academia cadastrada.
              </p>
            </div>
          ) : (
            <Button
              className="w-full !rounded-2xl !py-5 text-lg"
              disabled={isRestDay || (group.require_location && gyms.isLoading)}
              onClick={() => navigate('/check-in')}
            >
              {isRestDay ? 'Domingo é folga' : '📸 Fiz meu treino'}
            </Button>
          )}
        </div>

        {mine && !mine.joker && jokerAvailable && (mine.progress.status === 'at_risk' || mine.progress.status === 'missed') && (
          <Link to="/excecoes" className="block">
            <Card className="border-warn/30 bg-warn/5 text-sm">
              <b className="text-warn">Vai faltar?</b> Você ainda tem o coringa do mês. Ele cancela a punição desta
              semana. Ou marque uma exceção (doença, viagem, lesão, menstruação). ›
            </Card>
          </Link>
        )}

        <Link to="/sequencia" className="block">
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Sequência {members.length === 2 ? 'do casal' : 'do grupo'}</p>
              <p className="text-lg font-semibold">
                🔥 {streak.current} {streak.current === 1 ? 'semana' : 'semanas'}
              </p>
            </div>
            <span className="text-sm text-muted">Recorde: {streak.best} ›</span>
          </Card>
        </Link>
      </div>
    </div>
  )
}

function statusText(mw: MemberWeek): { text: string; tone: string } {
  const p = mw.progress
  switch (p.status) {
    case 'met':
      return { text: 'Meta batida 🎉', tone: 'text-ok' }
    case 'joker':
      return { text: '🃏 Coringa usado: sem punição nesta semana', tone: 'text-warn' }
    case 'missed':
      return { text: 'Não dá mais para bater a meta', tone: 'text-danger' }
    case 'at_risk':
      return { text: `Faltam ${p.missing} em ${p.daysLeft} ${p.daysLeft === 1 ? 'dia' : 'dias'}: não pode falhar`, tone: 'text-warn' }
    case 'not_started':
      return { text: `Meta começa ${dayMonth(mw.member.starts_on)}`, tone: 'text-muted' }
    default:
      return { text: `Faltam ${p.missing} em ${p.daysLeft} dias`, tone: 'text-muted' }
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
    <Card className={cx(isMe && 'border-accent/40')}>
      <div className="flex items-center gap-3">
        <Avatar name={member.display_name} color={color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {member.display_name}
            {isMe && <span className="ml-1 text-xs font-normal text-muted">(você)</span>}
          </p>
          <p className={cx('text-xs', status.tone)}>{status.text}</p>
        </div>
        <p className="text-3xl font-bold tabular-nums">
          {progress.done}
          <span className="text-lg text-muted">/{progress.goal}</span>
        </p>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>

      <div className="mt-3 flex justify-between">
        {days.map((d) => {
          const isToday = d === today
          const did = trained.has(d)
          const exc = justified.has(d)
          return (
            <div key={d} className="flex flex-col items-center gap-1" title={weekdayLong(d)}>
              <span className={cx('text-[10px] uppercase', isToday ? 'text-ink' : 'text-muted')}>{weekdayShort(d)}</span>
              <span
                className={cx(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  did ? 'text-bg' : exc ? 'border border-warn/60 text-warn' : 'border border-line text-muted',
                  isToday && !did && 'ring-2 ring-ink/40',
                )}
                style={did ? { background: color } : undefined}
              >
                {did ? '✓' : exc ? 'E' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

const SEEN_PREFIX = 'treino:semana-vista:'

function WeekResultBanner({ week, results }: { week: Week | undefined; results: WeekResult[] }) {
  const { nameOf } = useGroup()
  const [dismissed, setDismissed] = useState(() => {
    if (!week) return true
    try {
      return localStorage.getItem(SEEN_PREFIX + week.id) === '1'
    } catch {
      return false
    }
  })
  if (!week || dismissed) return null

  const rows = results.filter((r) => r.week_id === week.id)
  const owing = rows.filter((r) => r.owes)
  const close = () => {
    try {
      localStorage.setItem(SEEN_PREFIX + week.id, '1')
    } catch {
      /* ignora */
    }
    setDismissed(true)
  }

  return (
    <Card className={cx('animate-pop', owing.length ? 'border-danger/40 bg-danger/5' : 'border-ok/40 bg-ok/5')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted">Semana {weekRange(week.week_start)} fechada</p>
        <button className="-mt-1 px-1 text-muted" onClick={close} aria-label="Dispensar">
          ✕
        </button>
      </div>
      {owing.length === 0 ? (
        <p className="mt-1 text-lg font-semibold">Todo mundo cumpriu. Sem punição! 💪</p>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold">
            {owing.map((r) => nameOf(r.user_id)).join(' e ')} {owing.length > 1 ? 'pagam' : 'paga'}{' '}
            {formatMoney(week.fine_amount ?? 0)}
          </p>
          {week.punishment_text && (
            <p className="mt-1 text-sm">
              🎡 {owing.length > 1 ? 'E os dois:' : 'E mais:'} <b>{week.punishment_text}</b>
            </p>
          )}
          <Link to="/caixinha" onClick={close} className="mt-2 inline-block text-sm text-accent">
            Ver caixinha ›
          </Link>
        </>
      )}
      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {rows.map((r) => (
          <li key={r.user_id}>
            {nameOf(r.user_id)}: {r.checkins}/{r.goal} {r.met ? '✓' : r.used_joker ? '🃏 coringa' : '✗'}
          </li>
        ))}
      </ul>
    </Card>
  )
}
