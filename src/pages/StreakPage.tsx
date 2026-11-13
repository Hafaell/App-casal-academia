import { useMemo } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Avatar, Card, EmptyState, PageHeader, Spinner, memberColor } from '@/components/ui'
import { useWeekResults } from '@/data/queries'
import { weekRange } from '@/domain/dates'
import { groupStreak, personStreak, type WeekOutcome } from '@/domain/streak'

export function StreakPage() {
  const { group, members } = useGroup()
  const results = useWeekResults(group.id)

  const outcomes = useMemo<WeekOutcome[]>(
    () => (results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker })),
    [results.data],
  )
  const weeks = [...new Set(outcomes.map((o) => o.weekStart))].sort().reverse()
  const together = groupStreak(outcomes)

  return (
    <div>
      <PageHeader title="Sequência" back="/mais" />
      <div className="space-y-4 px-4 pt-4">
        {results.isLoading ? (
          <Spinner />
        ) : (
          <>
            <Card className="border-accent/40 bg-accent/5 text-center">
              <p className="text-sm text-muted">{members.length === 2 ? 'O casal' : 'O grupo todo'}</p>
              <p className="text-5xl font-bold">🔥 {together.current}</p>
              <p className="text-sm text-muted">
                {together.current === 1 ? 'semana seguida' : 'semanas seguidas'} · recorde {together.best}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {members.map((m, i) => {
                const s = personStreak(outcomes.filter((o) => o.userId === m.user_id))
                return (
                  <Card key={m.user_id} className="text-center">
                    <div className="mb-2 flex justify-center">
                      <Avatar name={m.display_name} color={memberColor(i)} />
                    </div>
                    <p className="truncate text-sm font-semibold">{m.display_name}</p>
                    <p className="text-3xl font-bold">{s.current}</p>
                    <p className="text-xs text-muted">recorde {s.best}</p>
                  </Card>
                )
              })}
            </div>

            <p className="text-xs text-muted">
              Semana salva pelo coringa não quebra a sequência, mas também não soma.
            </p>

            {weeks.length === 0 ? (
              <EmptyState>A primeira semana fecha no domingo às 23h59.</EmptyState>
            ) : (
              <Card className="!p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="p-3 font-medium">Semana</th>
                      {members.map((m) => (
                        <th key={m.user_id} className="p-3 text-center font-medium">
                          {m.display_name.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w) => (
                      <tr key={w} className="border-t border-line">
                        <td className="p-3">{weekRange(w)}</td>
                        {members.map((m) => {
                          const o = outcomes.find((x) => x.weekStart === w && x.userId === m.user_id)
                          return (
                            <td key={m.user_id} className="p-3 text-center">
                              {!o ? '·' : o.met ? '✅' : o.usedJoker ? '🃏' : '❌'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
