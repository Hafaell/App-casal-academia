import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Avatar, Button, Card, Chip, EmptyState, Field, Input, PageHeader, Screen, Sheet, Spinner, Txt, memberColor, useToast } from '@/components/ui'
import { GoalForm, GoalSection } from '@/components/KittyGoal'
import { useAddKittyWithdrawal, useDeleteKittyWithdrawal, useKittyGoals, useKittyWithdrawals, useSetDebtStatus, useWeekResults } from '@/data/queries'
import type { KittyGoal, KittyWithdrawal, WeekResult } from '@/data/types'
import { dayMonth, localDate, weekRange } from '@domain/dates'
import { formatMoney } from '@domain/rules'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

export function KittyScreen() {
  const { group, members, userId } = useGroup()
  const results = useWeekResults(group.id)
  const withdrawals = useKittyWithdrawals(group.id)
  const goals = useKittyGoals(group.id)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<KittyGoal | 'new' | null>(null)

  const debts = (results.data ?? []).filter((r) => r.owes)
  const paidTotal = debts.filter((d) => d.paid_at).reduce((s, d) => s + d.fine_amount, 0)
  const openTotal = debts.filter((d) => !d.paid_at).reduce((s, d) => s + d.fine_amount, 0)
  const withdrawnTotal = (withdrawals.data ?? []).reduce((s, w) => s + w.amount, 0)

  // Saldo disponível = tudo que já foi pago menos o que já foi retirado
  const balance = paidTotal - withdrawnTotal

  const visible = filter === 'open' ? debts.filter((d) => !d.paid_at || !d.task_done_at) : debts

  return (
    <Screen header={<PageHeader title="Caixinha" subtitle="O dinheiro vai por Pix; aqui fica o controle" />}>
      {/* Cards de resumo */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Txt size={12} muted>
            Já entrou
          </Txt>
          <Txt size={24} weight="700" color={colors.ok}>
            {formatMoney(paidTotal)}
          </Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt size={12} muted>
            Falta pagar
          </Txt>
          <Txt size={24} weight="700" color={colors.danger}>
            {formatMoney(openTotal)}
          </Txt>
        </Card>
      </View>

      {/* Saldo disponível + botão de retirada */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View>
            <Txt size={12} muted>
              Saldo disponível
            </Txt>
            <Txt size={24} weight="700" color={balance > 0 ? colors.ink : colors.muted}>
              {formatMoney(Math.max(0, balance))}
            </Txt>
            {withdrawnTotal > 0 && (
              <Txt size={12} muted style={{ marginTop: 2 }}>
                já retirado: {formatMoney(withdrawnTotal)}
              </Txt>
            )}
          </View>
          {balance > 0 && <Button onPress={() => setShowWithdrawModal(true)}>💸 Retirar</Button>}
        </View>
      </Card>

      {/* Objetivo da caixinha. Se a tabela ainda não existir no banco, some sem travar a tela. */}
      {goals.isSuccess && <GoalSection goals={goals.data} balance={Math.max(0, balance)} onEdit={setEditingGoal} />}

      {/* Quanto cada um deve */}
      <Card>
        <Txt size={14} weight="600" style={{ marginBottom: 8 }}>
          Quanto cada um deve
        </Txt>
        <View style={{ gap: 8 }}>
          {members.map((m, i) => {
            const owed = debts.filter((d) => d.user_id === m.user_id && !d.paid_at).reduce((s, d) => s + d.fine_amount, 0)
            const tasks = debts.filter((d) => d.user_id === m.user_id && d.punishment_text && !d.task_done_at).length
            return (
              <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={m.display_name} color={memberColor(i)} size={28} />
                <Txt size={14} style={{ flex: 1 }}>
                  {m.display_name}
                </Txt>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt size={14} weight="700" color={owed ? colors.danger : colors.muted}>
                    {formatMoney(owed)}
                  </Txt>
                  {tasks > 0 && (
                    <Txt size={12} color={colors.warn}>
                      {tasks} {tasks === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
                    </Txt>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </Card>

      {/* Histórico de retiradas */}
      {(withdrawals.data ?? []).length > 0 && (
        <Card>
          <Txt size={14} weight="600" style={{ marginBottom: 8 }}>
            Retiradas
          </Txt>
          <View style={{ gap: 8 }}>
            {(withdrawals.data ?? []).map((w) => (
              <WithdrawalRow
                key={w.id}
                withdrawal={w}
                myId={userId}
                // Retirada de um objetivo concluído não se desfaz: o objetivo continuaria marcado como feito.
                fromGoal={(goals.data ?? []).some((g) => g.withdrawal_id === w.id)}
              />
            ))}
          </View>
        </Card>
      )}

      {/* Filtro + lista de multas */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['open', 'all'] as const).map((f) => (
          <Chip
            key={f}
            label={f === 'open' ? 'Pendentes' : 'Todas'}
            active={filter === f}
            onPress={() => setFilter(f)}
            style={filter === f ? { backgroundColor: colors.ink } : { backgroundColor: colors.surface }}
          />
        ))}
      </View>

      {results.isLoading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState>{filter === 'open' ? 'Nada pendente. Ninguém está devendo 🎉' : 'Nenhuma multa até agora.'}</EmptyState>
      ) : (
        visible.map((d) => <DebtCard key={`${d.week_id}-${d.user_id}`} debt={d} />)
      )}

      <Sheet open={editingGoal !== null} onClose={() => setEditingGoal(null)}>
        {editingGoal !== null && (
          <GoalForm groupId={group.id} goal={editingGoal === 'new' ? null : editingGoal} onClose={() => setEditingGoal(null)} />
        )}
      </Sheet>

      {/* Janela de retirada */}
      <Sheet open={showWithdrawModal} onClose={() => setShowWithdrawModal(false)}>
        {showWithdrawModal && <WithdrawForm groupId={group.id} maxAmount={balance} onClose={() => setShowWithdrawModal(false)} />}
      </Sheet>
    </Screen>
  )
}

// ---------------------------------------------------------------------
// Retirada
// ---------------------------------------------------------------------

function WithdrawForm({ groupId, maxAmount, onClose }: { groupId: string; maxAmount: number; onClose: () => void }) {
  const addWithdrawal = useAddKittyWithdrawal(groupId)
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  function handleSubmit() {
    const val = Math.floor(Number(amount.replace(',', '.')))
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
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt size={18} weight="600">
          Registrar retirada
        </Txt>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fechar">
          <Txt size={20} muted>
            ✕
          </Txt>
        </Pressable>
      </View>

      <Txt size={14} muted>
        Saldo disponível:{' '}
        <Txt size={14} weight="600">
          {formatMoney(maxAmount)}
        </Txt>
      </Txt>

      <Field label="Valor retirado (R$)">
        <Input keyboardType="number-pad" placeholder="Ex: 50" value={amount} onChangeText={setAmount} autoFocus />
      </Field>

      <Field label="O que foi feito com o dinheiro?">
        <Input placeholder="Ex: Jantar no restaurante" value={description} onChangeText={setDescription} maxLength={200} />
      </Field>

      <Button onPress={handleSubmit} loading={addWithdrawal.isPending}>
        Confirmar retirada
      </Button>
    </View>
  )
}

// ---------------------------------------------------------------------
// Linha de retirada no histórico
// ---------------------------------------------------------------------

function WithdrawalRow({ withdrawal, myId, fromGoal }: { withdrawal: KittyWithdrawal; myId: string | undefined; fromGoal: boolean }) {
  const { group } = useGroup()
  const deleteWithdrawal = useDeleteKittyWithdrawal()
  const toast = useToast()
  const isMine = withdrawal.withdrawn_by === myId
  const day = localDate(withdrawal.created_at, group.timezone)

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Txt size={16}>💸</Txt>
      <View style={{ flex: 1 }}>
        <Txt size={14}>
          <Txt size={14} weight="500">
            {formatMoney(withdrawal.amount)}
          </Txt>
          <Txt size={14} muted>
            {' '}
            · {withdrawal.description}
          </Txt>
        </Txt>
        <Txt size={12} muted>
          {`${dayMonth(day)}/${day.slice(0, 4)}`}
        </Txt>
      </View>
      {isMine && !fromGoal && (
        <Pressable
          onPress={() => deleteWithdrawal.mutate(withdrawal.id, { onError: (err) => toast(errorMessage(err), 'error') })}
          disabled={deleteWithdrawal.isPending}
          style={{ opacity: deleteWithdrawal.isPending ? 0.5 : 1 }}
          accessibilityRole="button"
        >
          <Txt size={12} muted style={{ textDecorationLine: 'underline' }}>
            Desfazer
          </Txt>
        </Pressable>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------
// Card de dívida
// ---------------------------------------------------------------------

function DebtCard({ debt }: { debt: WeekResult }) {
  const { group, nameOf, userId } = useGroup()
  const setStatus = useSetDebtStatus()
  const toast = useToast()
  const run = (patch: { paid?: boolean; taskDone?: boolean }) =>
    setStatus.mutate({ weekId: debt.week_id, userId: debt.user_id, ...patch }, { onError: (err) => toast(errorMessage(err), 'error') })
  const mine = debt.user_id === userId
  const day = (iso: string) => dayMonth(localDate(iso, group.timezone))

  // Pagamento: quem deve avisa "Já paguei"; outra pessoa confirma o recebimento (só aí entra na caixinha).
  let payLabel: string
  if (debt.paid_at) payLabel = mine ? `Pago (confirmado ${day(debt.paid_at)})` : `Recebido ${day(debt.paid_at)}`
  else if (mine) payLabel = debt.paid_claimed_at ? 'Aguardando confirmação' : 'Já paguei'
  else payLabel = 'Confirmar recebimento'

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt weight="600">{nameOf(debt.user_id)}</Txt>
          <Txt size={12} muted>
            Semana {weekRange(debt.week_start)} · fez {debt.checkins}/{debt.goal}
          </Txt>
        </View>
        <Txt size={20} weight="700">
          {formatMoney(debt.fine_amount)}
        </Txt>
      </View>
      {debt.punishment_text && (
        <Txt size={14} style={{ marginTop: 8 }}>
          🎡 {debt.punishment_text}
        </Txt>
      )}

      {!debt.paid_at && debt.paid_claimed_at && (
        <Txt size={12} color={colors.warn} style={{ marginTop: 8 }}>
          {mine
            ? `Você avisou que pagou em ${day(debt.paid_claimed_at)}. Falta o parceiro confirmar.`
            : `${nameOf(debt.user_id)} avisou que pagou em ${day(debt.paid_claimed_at)}. Confira e confirme.`}
        </Txt>
      )}

      <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
        <Toggle
          on={Boolean(debt.paid_at) || (mine && Boolean(debt.paid_claimed_at))}
          label={payLabel}
          // Quem deve não desfaz uma confirmação; o banco também recusa.
          onPress={() => (mine ? run({ paid: !debt.paid_claimed_at }) : run({ paid: !debt.paid_at }))}
          disabled={setStatus.isPending || (mine && Boolean(debt.paid_at))}
        />
        {debt.punishment_text ? (
          <Toggle
            on={Boolean(debt.task_done_at)}
            label={debt.task_done_at ? 'Punição cumprida' : 'Marcar cumprida'}
            onPress={() => run({ taskDone: !debt.task_done_at })}
            disabled={setStatus.isPending}
          />
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
    </Card>
  )
}

function Toggle({ on, label, onPress, disabled }: { on: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      style={{
        flex: 1,
        minHeight: 44,
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        borderColor: on ? alpha(colors.ok, 0.4) : colors.line,
        backgroundColor: on ? alpha(colors.ok, 0.15) : colors.surface2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Txt size={14} weight="500" color={on ? colors.ok : colors.ink} center>
        {on ? '✓ ' : ''}
        {label}
      </Txt>
    </Pressable>
  )
}
