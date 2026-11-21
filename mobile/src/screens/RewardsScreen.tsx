/**
 * Roleta de prêmios: a cada 2 semanas seguidas em que os dois batem a meta, o casal ganha um giro.
 * O banco confere o marco e sorteia (public.spin_reward); aqui mostra, gira e guarda o histórico.
 */
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, EmptyState, Field, Input, PageHeader, Screen, Sheet, Spinner, Txt, confirmAsync, useToast } from '@/components/ui'
import { useDeleteReward, useRedeemReward, useRewardSpins, useRewards, useSaveReward, useSpinReward, useWeekResults } from '@/data/queries'
import type { Reward, RewardSpin } from '@/data/types'
import { weekRange } from '@domain/dates'
import { REWARD_EVERY_WEEKS, rewardMilestones, weeksToNextReward } from '@domain/rewards'
import { groupStreak, type WeekOutcome } from '@domain/streak'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

/** Marcos ainda sem giro (o mais antigo primeiro). Usado também pelo aviso do Início. */
export function usePendingRewards(): { pending: string[]; ready: boolean } {
  const { group } = useGroup()
  const results = useWeekResults(group.id)
  const spins = useRewardSpins(group.id)
  const pending = useMemo(() => {
    const outcomes: WeekOutcome[] = (results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker }))
    const done = new Set((spins.data ?? []).map((s) => s.week_start))
    return rewardMilestones(outcomes).filter((w) => !done.has(w))
  }, [results.data, spins.data])
  return { pending, ready: results.isSuccess && spins.isSuccess }
}

export function RewardsScreen() {
  const { group, members } = useGroup()
  const results = useWeekResults(group.id)
  const rewards = useRewards(group.id)
  const spins = useRewardSpins(group.id)
  const spin = useSpinReward(group.id)
  const { pending, ready } = usePendingRewards()
  const toast = useToast()
  const [won, setWon] = useState<RewardSpin | null>(null)
  const [editing, setEditing] = useState<Partial<Reward> | null>(null)

  const streak = useMemo(
    () => groupStreak((results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker }))),
    [results.data],
  )
  const activeCount = (rewards.data ?? []).filter((r) => r.active).length
  const couple = members.length === 2 ? 'os dois' : 'todo mundo'

  function spinNow() {
    const week = pending[0]
    if (!week) return
    setWon(null)
    spin.mutate(week, {
      onSuccess: (s) => setWon(s),
      onError: (err) => toast(errorMessage(err), 'error'),
    })
  }

  // Antes da atualização do banco, as tabelas da roleta de prêmios não existem.
  if (rewards.isError || spins.isError) {
    return (
      <Screen header={<PageHeader title="Roleta de prêmios" back />}>
        <EmptyState>A roleta de prêmios fica disponível depois que a atualização do banco for aplicada no Supabase.</EmptyState>
      </Screen>
    )
  }

  return (
    <Screen
      header={
        <PageHeader
          title="Roleta de prêmios"
          back
          subtitle={`A cada ${REWARD_EVERY_WEEKS} semanas seguidas em que ${couple} batem a meta`}
          right={
            <Button style={{ minHeight: 36, paddingVertical: 6 }} onPress={() => setEditing({ description: '' })}>
              + Novo
            </Button>
          }
        />
      }
    >
      {!ready || rewards.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Card style={{ alignItems: 'center', borderColor: alpha(colors.accent, 0.4), backgroundColor: alpha(colors.accent, 0.05) }}>
            {won ? (
              <>
                <Txt size={48}>🎉</Txt>
                <Txt size={14} muted>
                  Vocês ganharam
                </Txt>
                <Txt size={22} weight="700" center>
                  {won.reward_text}
                </Txt>
              </>
            ) : pending.length > 0 ? (
              <>
                <Txt size={48}>🎁</Txt>
                <Txt size={18} weight="700" center>
                  {pending.length === 1 ? 'Vocês ganharam um giro!' : `Vocês têm ${pending.length} giros!`}
                </Txt>
                <Txt size={12} muted center>
                  {REWARD_EVERY_WEEKS} semanas seguidas de meta batida até {weekRange(pending[0])}
                </Txt>
                <Button style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={spinNow} loading={spin.isPending} disabled={activeCount === 0}>
                  {spin.isPending ? 'Girando…' : '🎰 Girar a roleta'}
                </Button>
                {activeCount === 0 && (
                  <Txt size={12} color={colors.warn} center style={{ marginTop: 4 }}>
                    Ative pelo menos um prêmio abaixo para girar.
                  </Txt>
                )}
              </>
            ) : (
              <>
                <Txt size={48}>🔥 {streak.current}</Txt>
                <Txt size={14} muted center>
                  {streak.current === 1 ? 'semana seguida' : 'semanas seguidas'} batendo a meta juntos
                </Txt>
                <Txt size={16} weight="600" center style={{ marginTop: 8 }}>
                  Faltam {weeksToNextReward(streak.current)} {weeksToNextReward(streak.current) === 1 ? 'semana' : 'semanas'} para o próximo giro
                </Txt>
              </>
            )}
          </Card>

          {(spins.data ?? []).length > 0 && (
            <View style={{ gap: 8 }}>
              <Txt size={14} weight="600" muted>
                Prêmios ganhos
              </Txt>
              {(spins.data ?? []).map((s) => (
                <SpinRow key={s.id} spin={s} />
              ))}
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Txt size={14} weight="600" muted>
              Prêmios da roleta ({activeCount} ativos)
            </Txt>
            {(rewards.data ?? []).length === 0 ? (
              <EmptyState>Nenhum prêmio. Toque em + Novo para cadastrar.</EmptyState>
            ) : (
              (rewards.data ?? []).map((r) => <RewardRow key={r.id} reward={r} onEdit={() => setEditing(r)} />)
            )}
          </View>
        </>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && <RewardForm initial={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </Screen>
  )
}

function SpinRow({ spin }: { spin: RewardSpin }) {
  const redeem = useRedeemReward()
  const toast = useToast()
  const on = Boolean(spin.redeemed_at)
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt size={14} weight="600">
          🎁 {spin.reward_text}
        </Txt>
        <Txt size={12} muted>
          Semana {weekRange(spin.week_start)}
        </Txt>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        disabled={redeem.isPending}
        onPress={() => redeem.mutate({ id: spin.id, redeemed: !on }, { onError: (err) => toast(errorMessage(err), 'error') })}
        style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: on ? alpha(colors.ok, 0.15) : colors.surface2 }}
      >
        <Txt size={12} color={on ? colors.ok : colors.muted}>
          {on ? '✓ Aproveitado' : 'Marcar aproveitado'}
        </Txt>
      </Pressable>
    </Card>
  )
}

function RewardRow({ reward, onEdit }: { reward: Reward; onEdit: () => void }) {
  const { group } = useGroup()
  const save = useSaveReward(group.id)
  const toast = useToast()
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: reward.active ? 1 : 0.5 }}>
      <Pressable style={{ flex: 1 }} onPress={onEdit} accessibilityRole="button" accessibilityHint="Editar prêmio">
        <Txt size={14}>{reward.description}</Txt>
      </Pressable>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: reward.active }}
        onPress={() => save.mutate({ id: reward.id, active: !reward.active }, { onError: (err) => toast(errorMessage(err), 'error') })}
        style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: reward.active ? alpha(colors.ok, 0.15) : colors.surface2 }}
      >
        <Txt size={12} color={reward.active ? colors.ok : colors.muted}>
          {reward.active ? 'Ativo' : 'Pausado'}
        </Txt>
      </Pressable>
    </Card>
  )
}

function RewardForm({ initial, onDone }: { initial: Partial<Reward>; onDone: () => void }) {
  const { group } = useGroup()
  const save = useSaveReward(group.id)
  const remove = useDeleteReward()
  const toast = useToast()
  const [text, setText] = useState(initial.description ?? '')

  function submit() {
    if (!text.trim()) return toast('Escreva o prêmio', 'error')
    save.mutate(
      { id: initial.id, description: text },
      {
        onSuccess: () => {
          toast(initial.id ? 'Prêmio salvo' : 'Prêmio adicionado')
          onDone()
        },
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    )
  }

  async function del() {
    if (!initial.id) return
    if (!(await confirmAsync('Apagar este prêmio da roleta?', 'Apagar', true))) return
    remove.mutate(initial.id, { onSuccess: onDone, onError: (err) => toast(errorMessage(err), 'error') })
  }

  return (
    <View style={{ gap: 16 }}>
      <Txt size={18} weight="600">
        {initial.id ? 'Editar prêmio' : 'Novo prêmio'}
      </Txt>
      <Field label="Prêmio">
        <Input placeholder="Ex.: Jantar japonês" value={text} onChangeText={setText} maxLength={200} autoFocus />
      </Field>
      <Button onPress={submit} loading={save.isPending}>
        Salvar
      </Button>
      {initial.id && (
        <Button variant="ghost" onPress={del} disabled={remove.isPending}>
          Apagar prêmio
        </Button>
      )}
    </View>
  )
}
