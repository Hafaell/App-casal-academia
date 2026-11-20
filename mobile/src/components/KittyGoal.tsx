/** Caixinha: objetivo (para onde vai o dinheiro) e chave Pix de quem guarda o dinheiro. */
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, Field, Input, Txt, confirmAsync, useToast } from '@/components/ui'
import { useCompleteKittyGoal, useDeleteKittyGoal, useSaveKittyGoal, useSavePix } from '@/data/queries'
import type { KittyGoal } from '@/data/types'
import { dayMonth, localDate } from '@domain/dates'
import { pixPayload } from '@domain/pix'
import { formatMoney } from '@domain/rules'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

export function GoalSection({ goals, balance, onEdit }: { goals: KittyGoal[]; balance: number; onEdit: (g: KittyGoal | 'new') => void }) {
  const { group } = useGroup()
  const complete = useCompleteKittyGoal()
  const remove = useDeleteKittyGoal()
  const toast = useToast()
  const open = goals.find((g) => !g.completed_at)
  const done = goals.filter((g) => g.completed_at)
  const reached = open ? balance >= open.target_amount : false

  async function spend(goal: KittyGoal) {
    const ok = await confirmAsync(
      `Usar ${formatMoney(goal.target_amount)} da caixinha em "${goal.title}"? Fica registrado como retirada.`,
      'Usar o dinheiro',
    )
    if (!ok) return
    complete.mutate(goal.id, {
      onSuccess: () => toast('Objetivo concluído! Aproveitem 🎉'),
      onError: (err) => toast(errorMessage(err), 'error'),
    })
  }

  async function del(goal: KittyGoal) {
    if (!(await confirmAsync(`Apagar o objetivo "${goal.title}"? O dinheiro da caixinha não muda.`, 'Apagar', true))) return
    remove.mutate(goal.id, { onError: (err) => toast(errorMessage(err), 'error') })
  }

  return (
    <Card style={open ? { borderColor: alpha(colors.accent, 0.4) } : undefined}>
      {open ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Txt size={12} muted>
                Objetivo da caixinha
              </Txt>
              <Txt size={18} weight="700">
                🎯 {open.title}
              </Txt>
            </View>
            <Pressable onPress={() => onEdit(open)} hitSlop={10} accessibilityRole="button">
              <Txt size={12} color={colors.accent}>
                Editar
              </Txt>
            </Pressable>
          </View>
          <View
            style={{ marginTop: 12, height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surface2 }}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: open.target_amount, now: Math.min(balance, open.target_amount) }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, (balance / open.target_amount) * 100)}%`,
                borderRadius: 5,
                backgroundColor: reached ? colors.ok : colors.accent,
              }}
            />
          </View>
          <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt size={14} weight="600">
              {formatMoney(Math.min(balance, open.target_amount))} de {formatMoney(open.target_amount)}
            </Txt>
            <Txt size={14} color={reached ? colors.ok : colors.muted}>
              {reached ? 'Chegou lá! 🎉' : `Faltam ${formatMoney(open.target_amount - balance)}`}
            </Txt>
          </View>
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
            {reached && (
              <Button style={{ flex: 1 }} onPress={() => spend(open)} loading={complete.isPending}>
                🎉 Usar o dinheiro
              </Button>
            )}
            <Button variant="ghost" style={reached ? undefined : { flex: 1 }} onPress={() => del(open)} disabled={remove.isPending}>
              Apagar objetivo
            </Button>
          </View>
        </>
      ) : (
        <>
          <Txt weight="600">Para onde vai o dinheiro?</Txt>
          <Txt size={14} muted style={{ marginTop: 4 }}>
            Deem um destino para a caixinha (viagem, jantar, presente) e acompanhem quanto falta.
          </Txt>
          <Button style={{ marginTop: 12 }} onPress={() => onEdit('new')}>
            🎯 Criar objetivo
          </Button>
        </>
      )}

      {done.length > 0 && (
        <View style={{ marginTop: 16, gap: 4 }}>
          <Txt size={12} muted>
            Objetivos concluídos
          </Txt>
          {done.map((g) => (
            <Txt key={g.id} size={14}>
              ✓ {g.title} · {formatMoney(g.target_amount)} · {dayMonth(localDate(g.completed_at!, group.timezone))}
            </Txt>
          ))}
        </View>
      )}
    </Card>
  )
}

export function GoalForm({ groupId, goal, onClose }: { groupId: string; goal: KittyGoal | null; onClose: () => void }) {
  const save = useSaveKittyGoal(groupId)
  const toast = useToast()
  const [title, setTitle] = useState(goal?.title ?? '')
  const [amount, setAmount] = useState(goal ? String(goal.target_amount) : '')

  function submit() {
    const value = Math.floor(Number(amount.replace(',', '.')))
    if (!title.trim()) return toast('Dê um nome para o objetivo', 'error')
    if (!value || value <= 0) return toast('Informe o valor do objetivo', 'error')
    save.mutate(
      { id: goal?.id, title, target_amount: value },
      {
        onSuccess: () => {
          toast(goal ? 'Objetivo atualizado' : 'Objetivo criado!')
          onClose()
        },
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    )
  }

  return (
    <View style={{ gap: 16 }}>
      <SheetTitle title={goal ? 'Editar objetivo' : 'Novo objetivo'} onClose={onClose} />
      <Field label="Objetivo">
        <Input placeholder="Ex: Viagem para a praia" value={title} onChangeText={setTitle} maxLength={60} autoFocus />
      </Field>
      <Field label="Valor do objetivo (R$)">
        <Input keyboardType="number-pad" placeholder="Ex: 300" value={amount} onChangeText={setAmount} />
      </Field>
      <Button onPress={submit} loading={save.isPending}>
        {goal ? 'Salvar' : 'Criar objetivo'}
      </Button>
    </View>
  )
}

export function PixCard({ onEdit }: { onEdit: () => void }) {
  const { group } = useGroup()
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="600">
            Pix da caixinha
          </Txt>
          <Txt size={12} muted>
            {group.pix_key
              ? `As multas vão para ${group.pix_name} (${group.pix_key})`
              : 'Cadastre a chave de quem guarda o dinheiro para copiar o Pix de cada multa.'}
          </Txt>
        </View>
        <Pressable onPress={onEdit} hitSlop={10} accessibilityRole="button">
          <Txt size={14} color={colors.accent}>
            {group.pix_key ? 'Editar' : 'Cadastrar'}
          </Txt>
        </Pressable>
      </View>
    </Card>
  )
}

export function PixForm({ onClose }: { onClose: () => void }) {
  const { group } = useGroup()
  const save = useSavePix(group.id)
  const toast = useToast()
  const [key, setKey] = useState(group.pix_key ?? '')
  const [name, setName] = useState(group.pix_name ?? '')
  const [city, setCity] = useState(group.pix_city ?? '')

  function submit() {
    const clean = { pix_key: key.trim() || null, pix_name: name.trim() || null, pix_city: city.trim() || null }
    if (clean.pix_key) {
      try {
        // Monta um código de teste: recusa antes de salvar se faltar algo.
        pixPayload({ key: clean.pix_key, name: clean.pix_name ?? '', city: clean.pix_city ?? '' })
      } catch (err) {
        return toast(errorMessage(err), 'error')
      }
    }
    save.mutate(clean, {
      onSuccess: () => {
        toast(clean.pix_key ? 'Chave Pix salva' : 'Chave Pix removida')
        onClose()
      },
      onError: (err) => toast(errorMessage(err), 'error'),
    })
  }

  return (
    <View style={{ gap: 16 }}>
      <SheetTitle title="Pix da caixinha" onClose={onClose} />
      <Txt size={14} muted>
        O app só monta o código "Pix copia e cola". O dinheiro vai direto de um banco para o outro.
      </Txt>
      <Field label="Chave Pix">
        <Input
          placeholder="E-mail, celular com DDD, CPF ou chave aleatória"
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={77}
        />
      </Field>
      <Field label="Nome de quem recebe">
        <Input placeholder="Como aparece no banco" value={name} onChangeText={setName} maxLength={25} />
      </Field>
      <Field label="Cidade">
        <Input placeholder="Ex: Vitória" value={city} onChangeText={setCity} maxLength={15} />
      </Field>
      <Button onPress={submit} loading={save.isPending}>
        Salvar
      </Button>
    </View>
  )
}

function SheetTitle({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt size={18} weight="600">
        {title}
      </Txt>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fechar">
        <Txt size={20} muted>
          ✕
        </Txt>
      </Pressable>
    </View>
  )
}
