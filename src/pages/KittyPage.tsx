import { useState, type FormEvent } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Avatar, Button, Card, EmptyState, Field, PageHeader, Spinner, cx, inputClass, memberColor, useToast } from '@/components/ui'
import { useAddKittyWithdrawal, useDeleteKittyWithdrawal, useKittyWithdrawals, useSetDebtStatus, useWeekResults } from '@/data/queries'
import type { KittyWithdrawal, WeekResult } from '@/data/types'
import { dayMonth, localDate, weekRange } from '@/domain/dates'
import { formatMoney } from '@/domain/rules'
import { errorMessage } from '@/lib/supabase'

export function KittyPage() {
  const { group, members, userId } = useGroup()
  const results = useWeekResults(group.id)
  const withdrawals = useKittyWithdrawals(group.id)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)

  const debts = (results.data ?? []).filter((r) => r.owes)
  const paidTotal = debts.filter((d) => d.paid_at).reduce((s, d) => s + d.fine_amount, 0)
  const openTotal = debts.filter((d) => !d.paid_at).reduce((s, d) => s + d.fine_amount, 0)
  const withdrawnTotal = (withdrawals.data ?? []).reduce((s, w) => s + w.amount, 0)

  // Saldo disponível = tudo que já foi pago menos o que já foi retirado
  const balance = paidTotal - withdrawnTotal

  const visible = filter === 'open' ? debts.filter((d) => !d.paid_at || !d.task_done_at) : debts

  return (
    <div>
      <PageHeader title="Caixinha" subtitle="O dinheiro vai por Pix; aqui fica o controle" />
      <div className="space-y-4 px-4 pt-4">

        {/* Cards de resumo */}
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

        {/* Saldo disponível + botão de retirada */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Saldo disponível</p>
              <p className={cx('text-2xl font-bold', balance > 0 ? 'text-ink' : 'text-muted')}>
                {formatMoney(Math.max(0, balance))}
              </p>
              {withdrawnTotal > 0 && (
                <p className="text-xs text-muted mt-0.5">já retirado: {formatMoney(withdrawnTotal)}</p>
              )}
            </div>
            {balance > 0 && (
              <Button onClick={() => setShowWithdrawModal(true)}>
                💸 Retirar
              </Button>
            )}
          </div>
        </Card>

        {/* Quanto cada um deve */}
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

        {/* Histórico de retiradas */}
        {(withdrawals.data ?? []).length > 0 && (
          <Card>
            <p className="mb-2 text-sm font-semibold">Retiradas</p>
            <ul className="space-y-2">
              {(withdrawals.data ?? []).map((w) => (
                <WithdrawalRow key={w.id} withdrawal={w} myId={userId} />
              ))}
            </ul>
          </Card>
        )}

        {/* Filtro + lista de multas */}
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

      {/* Modal de retirada */}
      {showWithdrawModal && (
        <WithdrawModal
          groupId={group.id}
          maxAmount={balance}
          onClose={() => setShowWithdrawModal(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Modal de retirada
// ---------------------------------------------------------------------

function WithdrawModal({ groupId, maxAmount, onClose }: { groupId: string; maxAmount: number; onClose: () => void }) {
  const addWithdrawal = useAddKittyWithdrawal(groupId)
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const val = Math.floor(Number(amount))
    if (!val || val <= 0) return toast('Informe um valor válido', 'error')
    if (val > maxAmount) return toast(`O saldo disponível é ${formatMoney(maxAmount)}`, 'error')
    if (!description.trim()) return toast('Descreva o motivo da retirada', 'error')

    addWithdrawal.mutate(
      { amount: val, description: description.trim() },
      {
        onSuccess: () => {
          toast('Retirada registrada!')
          onClose()
        },
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    )
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-bg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Registrar retirada</h2>
          <button onClick={onClose} className="text-muted text-xl leading-none">✕</button>
        </div>

        <p className="text-sm text-muted">
          Saldo disponível: <span className="font-semibold text-ink">{formatMoney(maxAmount)}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Valor retirado (R$)">
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min={1}
              max={maxAmount}
              placeholder="Ex: 50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field label="O que foi feito com o dinheiro?">
            <input
              className={inputClass}
              type="text"
              placeholder="Ex: Jantar no restaurante"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              required
            />
          </Field>

          <Button type="submit" loading={addWithdrawal.isPending} className="w-full">
            Confirmar retirada
          </Button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Linha de retirada no histórico
// ---------------------------------------------------------------------

function WithdrawalRow({ withdrawal, myId }: { withdrawal: KittyWithdrawal; myId: string | undefined }) {
  const deleteWithdrawal = useDeleteKittyWithdrawal()
  const toast = useToast()
  const isMine = withdrawal.withdrawn_by === myId

  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="text-base">💸</span>
      <span className="flex-1">
        <span className="font-medium">{formatMoney(withdrawal.amount)}</span>
        <span className="text-muted"> · {withdrawal.description}</span>
        <span className="block text-xs text-muted">{new Date(withdrawal.created_at).toLocaleDateString('pt-BR')}</span>
      </span>
      {isMine && (
        <button
          onClick={() =>
            deleteWithdrawal.mutate(withdrawal.id, {
              onError: (err) => toast(errorMessage(err), 'error'),
            })
          }
          disabled={deleteWithdrawal.isPending}
          className="text-xs text-muted underline disabled:opacity-50"
        >
          Desfazer
        </button>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------
// Card de dívida
// ---------------------------------------------------------------------

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
