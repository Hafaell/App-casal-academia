/**
 * Desafio do mês: um objetivo do casal no mês (ex.: 8 treinos de cardio somados).
 * Não mexe em meta nem multa. Cumprido, dá um giro extra na roleta de prêmios.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, Chip, EmptyState, Field, Input, PageHeader, Screen, Spinner, Txt, confirmAsync, useToast } from '@/components/ui'
import { useChallenges, useCheckins, useDeleteChallenge, useRewardSpins, useSaveChallenge } from '@/data/queries'
import type { Checkin, MonthlyChallenge } from '@/data/types'
import { addMonths, firstOfMonth, monthLabel } from '@domain/dates'
import { CHALLENGE_KIND_LABEL, CHALLENGE_PRESETS, challengeProgress, type ChallengeKind } from '@domain/challenges'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

export function ChallengeScreen() {
  const { group, today } = useGroup()
  const thisMonth = firstOfMonth(today)
  const nextMonth = addMonths(thisMonth, 1)
  const challenges = useChallenges(group.id)
  const checkins = useCheckins(group.id, thisMonth, today)

  if (challenges.isError) {
    return (
      <Screen header={<PageHeader title="Desafio do mês" back />}>
        <EmptyState>O desafio do mês fica disponível depois que a atualização do banco for aplicada no Supabase.</EmptyState>
      </Screen>
    )
  }

  const of = (month: string) => (challenges.data ?? []).find((c) => c.month === month)
  const past = (challenges.data ?? []).filter((c) => c.month < thisMonth)

  return (
    <Screen header={<PageHeader title="Desafio do mês" subtitle="Cumpriu o desafio, ganha um giro na roleta de prêmios" back />}>
      {challenges.isLoading || checkins.isLoading ? (
        <Spinner />
      ) : (
        <>
          <MonthBlock month={thisMonth} challenge={of(thisMonth)} checkins={checkins.data ?? []} current />
          <MonthBlock month={nextMonth} challenge={of(nextMonth)} checkins={[]} />
          {past.length > 0 && (
            <View style={{ gap: 4 }}>
              <Txt size={14} weight="600" muted>
                Desafios anteriores
              </Txt>
              {past.map((c) => (
                <Txt key={c.id} size={14} muted>
                  {monthLabel(c.month)}: {c.title} ({c.target} {CHALLENGE_KIND_LABEL[c.kind].toLowerCase()})
                </Txt>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  )
}

function MonthBlock({ month, challenge, checkins, current }: { month: string; challenge?: MonthlyChallenge; checkins: Checkin[]; current?: boolean }) {
  const [editing, setEditing] = useState(false)
  return (
    <View style={{ gap: 8 }}>
      <Txt size={14} weight="600" muted>
        {current ? 'Este mês' : 'Próximo mês'} · {monthLabel(month)}
      </Txt>
      {challenge && !editing ? (
        <ChallengeCard challenge={challenge} checkins={checkins} current={current} onEdit={() => setEditing(true)} />
      ) : (
        <ChallengeForm month={month} challenge={challenge} onDone={() => setEditing(false)} />
      )}
    </View>
  )
}

function ChallengeCard({ challenge, checkins, current, onEdit }: { challenge: MonthlyChallenge; checkins: Checkin[]; current?: boolean; onEdit: () => void }) {
  const { group } = useGroup()
  const remove = useDeleteChallenge()
  const spins = useRewardSpins(group.id)
  const toast = useToast()
  const p = challengeProgress(challenge, checkins)
  // Depois do giro o banco trava o desafio (apagar e recriar daria outro giro).
  const spun = (spins.data ?? []).some((s) => s.challenge_id === challenge.id)
  const pct = Math.min(100, (p.done / p.target) * 100)

  async function del() {
    if (!(await confirmAsync(`Apagar o desafio "${challenge.title}"?`, 'Apagar', true))) return
    remove.mutate(challenge.id, { onError: (err) => toast(errorMessage(err), 'error') })
  }

  return (
    <Card style={p.complete ? { borderColor: alpha(colors.ok, 0.5), backgroundColor: alpha(colors.ok, 0.06) } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Txt size={18} weight="700">
            🏆 {challenge.title}
          </Txt>
          <Txt size={12} muted>
            {challenge.target} {CHALLENGE_KIND_LABEL[challenge.kind].toLowerCase()} no mês, somando os dois
          </Txt>
        </View>
        {!spun && (
          <Pressable onPress={onEdit} hitSlop={10} accessibilityRole="button">
            <Txt size={12} color={colors.accent}>
              Editar
            </Txt>
          </Pressable>
        )}
      </View>
      {current && (
        <>
          <View style={{ marginTop: 12, height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surface2 }}>
            <View style={{ height: '100%', width: `${pct}%`, borderRadius: 5, backgroundColor: p.complete ? colors.ok : colors.accent }} />
          </View>
          <Txt size={14} weight="600" style={{ marginTop: 8 }}>
            {p.done} de {p.target}
            {p.complete ? ' · Cumprido! 🎉' : ''}
          </Txt>
          {spun ? (
            <Txt size={14} color={colors.ok} style={{ marginTop: 8 }}>
              🎁 Giro de prêmio já usado
            </Txt>
          ) : p.complete && (
            <Button style={{ marginTop: 8 }} onPress={() => router.push('/premios')}>
              🎁 Girar a roleta de prêmios
            </Button>
          )}
        </>
      )}
      {!spun && (
        <Button variant="ghost" style={{ marginTop: 4 }} onPress={del} disabled={remove.isPending}>
          Apagar desafio
        </Button>
      )}
    </Card>
  )
}

function ChallengeForm({ month, challenge, onDone }: { month: string; challenge?: MonthlyChallenge; onDone: () => void }) {
  const { group } = useGroup()
  const save = useSaveChallenge(group.id)
  const toast = useToast()
  const [title, setTitle] = useState(challenge?.title ?? '')
  const [kind, setKind] = useState<ChallengeKind>(challenge?.kind ?? 'total')
  const [target, setTarget] = useState(challenge ? String(challenge.target) : '')

  function submit(values?: { title: string; kind: ChallengeKind; target: number }) {
    const v = values ?? { title, kind, target: Math.floor(Number(target) || 0) }
    if (!v.title.trim()) return toast('Dê um nome para o desafio', 'error')
    if (v.target < 1 || v.target > 200) return toast('A quantidade precisa ser de 1 a 200', 'error')
    save.mutate(
      { id: challenge?.id, month, ...v },
      {
        onSuccess: () => {
          toast(challenge ? 'Desafio salvo' : 'Desafio criado!')
          onDone()
        },
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    )
  }

  return (
    <Card style={{ gap: 12 }}>
      {!challenge && (
        <>
          <Txt size={14} muted>
            Escolha uma sugestão ou monte o seu:
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CHALLENGE_PRESETS.map((p) => (
              <Chip
                key={p.title}
                label={`${p.title} · ${p.target}`}
                active={false}
                onPress={() => submit(p)}
                accessibilityLabel={`Criar ${p.title} em ${monthLabel(month)}`}
              />
            ))}
          </View>
        </>
      )}
      <Field label="Nome do desafio">
        <Input placeholder="Ex.: Mês do cardio" value={title} onChangeText={setTitle} maxLength={60} />
      </Field>
      <Field label="O que conta">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(CHALLENGE_KIND_LABEL) as ChallengeKind[]).map((k) => (
            <Chip key={k} label={CHALLENGE_KIND_LABEL[k]} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
      </Field>
      <Field label="Quantos no mês (somando os dois)">
        <Input keyboardType="number-pad" placeholder="Ex.: 8" value={target} onChangeText={setTarget} />
      </Field>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} onPress={() => submit()} loading={save.isPending}>
          {challenge ? 'Salvar' : 'Criar desafio'}
        </Button>
        {challenge && (
          <Button variant="secondary" onPress={onDone}>
            Cancelar
          </Button>
        )}
      </View>
    </Card>
  )
}
