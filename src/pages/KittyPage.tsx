import { useState } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Avatar, Card, EmptyState, PageHeader, Spinner, cx, memberColor, useToast } from '@/components/ui'
import { useSetDebtStatus, useWeekResults } from '@/data/queries'
import type { WeekResult } from '@/data/types'
import { dayMonth, localDate, weekRange } from '@/domain/dates'
import { formatMoney } from '@/domain/rules'
import { errorMessage } from '@/lib/supabase'

export function KittyPage() {
  const { group, members } = useGroup()
  const results = useWeekResults(group.id)
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  const debts = (results.data ?? []).filter((r) => r.owes)
  const paidTotal = debts.filter((d) => d.paid_at).reduce((s, d) => s + d.fine_amount, 0)
  const openTotal = debts.filter((d) => !d.paid_at).reduce((s, d) => s + d.fine_amount, 0)
  const visible = filter === 'open' ? debts.filter((d) => !d.paid_at || !d.task_done_at) : debts

  return (
    <div>
      <PageHeader title="Caixinha" subtitle="O dinheiro vai por Pix; aqui fica o controle" />
      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-muted">Já entrou</p>
            <p className="text-2xl font-bold text-ok">{formatMoney(paidTotal)}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Falta pagar</p>
            <p className="text-2xl font-bold text-danger">{formatMoney(openTotal)}</p>
          </Card>
        </div>

        <Card>
          <p className="mb-2 text-sm font-semibold">Quanto cada um deve</p>
          <ul className="space-y-2">
            {members.map((m, i) => {
              const owed = debts.filter((d) => d.user_id === m.user_id && !d.paid_at).reduce((s, d) => s + d.fine_amount, 0)
              const tasks = debts.filter((d) => d.user_id === m.user_id && d.punishment_text && !d.task_done_at).length
              return (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar name={m.display_name} color={memberColor(i)} size={28} />
                  <span className="flex-1 text-sm">{m.display_name}</span>
                  <span className="text-right text-sm">
                    <b className={owed ? 'text-danger' : 'text-muted'}>{formatMoney(owed)}</b>
                    {tasks > 0 && (
                      <span className="block text-xs text-warn">
                        {tasks} {tasks === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>

        <div className="flex gap-2">
          {(['open', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cx('rounded-full px-3 py-1.5 text-sm', filter === f ? 'bg-ink text-bg' : 'bg-surface text-muted')}
            >
              {f === 'open' ? 'Pendentes' : 'Todas'}
            </button>
          ))}
        </div>

        {results.isLoading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <EmptyState>{filter === 'open' ? 'Nada pendente. Ninguém está devendo 🎉' : 'Nenhuma multa até agora.'}</EmptyState>
        ) : (
          visible.map((d) => <DebtCard key={`${d.week_id}-${d.user_id}`} debt={d} />)
        )}
      </div>
    </div>
  )
}

function DebtCard({ debt }: { debt: WeekResult }) {
  const { group, nameOf } = useGroup()
  const setStatus = useSetDebtStatus()
  const toast = useToast()
  const run = (patch: { paid?: boolean; taskDone?: boolean }) =>
    setStatus.mutate(
      { weekId: debt.week_id, userId: debt.user_id, ...patch },
      { onError: (err) => toast(errorMessage(err), 'error') },
    )

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{nameOf(debt.user_id)}</p>
          <p className="text-xs text-muted">
            Semana {weekRange(debt.week_start)} · fez {debt.checkins}/{debt.goal}
          </p>
        </div>
        <p className="text-xl font-bold">{formatMoney(debt.fine_amount)}</p>
      </div>
      {debt.punishment_text && <p className="mt-2 text-sm">🎡 {debt.punishment_text}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Toggle
          on={Boolean(debt.paid_at)}
          label={debt.paid_at ? `Pago ${dayMonth(localDate(debt.paid_at, group.timezone))}` : 'Marcar pago'}
          onClick={() => run({ paid: !debt.paid_at })}
          disabled={setStatus.isPending}
        />
        {debt.punishment_text ? (
          <Toggle
            on={Boolean(debt.task_done_at)}
            label={debt.task_done_at ? 'Punição cumprida' : 'Marcar cumprida'}
            onClick={() => run({ taskDone: !debt.task_done_at })}
            disabled={setStatus.isPending}
          />
        ) : (
          <span />
        )}
      </div>
    </Card>
  )
}

function Toggle({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'min-h-11 rounded-xl border px-3 text-sm font-medium transition disabled:opacity-50',
        on ? 'border-ok/40 bg-ok/15 text-ok' : 'border-line bg-surface-2 text-ink',
      )}
    >
      {on ? '✓ ' : ''}
      {label}
    </button>
  )
}
