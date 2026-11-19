import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, Chip, EmptyState, Field, Input, PageHeader, Screen, Sheet, Spinner, Txt, confirmAsync, useToast } from '@/components/ui'
import { useDeletePunishment, usePunishments, useSavePunishment } from '@/data/queries'
import type { Punishment } from '@/data/types'
import { formatMoney } from '@domain/rules'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

const KINDS = ['Tarefa', 'Perda de escolha', 'Date', 'Constrangimento leve']

export function RouletteScreen() {
  const { group } = useGroup()
  const punishments = usePunishments(group.id)
  const save = useSavePunishment(group.id)
  const [editing, setEditing] = useState<Partial<Punishment> | null>(null)
  const toast = useToast()

  const active = (punishments.data ?? []).filter((p) => p.active).length

  return (
    <Screen
      header={
        <PageHeader
          title="Roleta"
          back
          subtitle={`${active} ativas · multa de ${formatMoney(group.fine_min)} a ${formatMoney(group.fine_max)}`}
          right={
            <Button style={{ minHeight: 36, paddingVertical: 6 }} onPress={() => setEditing({ kind: KINDS[0], description: '' })}>
              + Nova
            </Button>
          }
        />
      }
    >
      <View style={{ gap: 8 }}>
        <Txt size={12} muted>
          No fechamento da semana, quem não bateu a meta recebe uma punição sorteada entre as ativas. Se mais de uma pessoa falhar, todas
          recebem a mesma.
        </Txt>
        {punishments.isLoading ? (
          <Spinner />
        ) : (punishments.data ?? []).length === 0 ? (
          <EmptyState>A roleta está vazia. Sem punições ativas, só a multa é sorteada.</EmptyState>
        ) : (
          (punishments.data ?? []).map((p) => (
            <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: p.active ? 1 : 0.5 }}>
              <Pressable style={{ flex: 1 }} onPress={() => setEditing(p)} accessibilityRole="button" accessibilityHint="Editar punição">
                <Txt size={12} muted>
                  {p.kind}
                </Txt>
                <Txt size={14}>{p.description}</Txt>
              </Pressable>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: p.active }}
                onPress={() =>
                  save.mutate({ id: p.id, kind: p.kind, description: p.description, active: !p.active }, { onError: (err) => toast(errorMessage(err), 'error') })
                }
                style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: p.active ? alpha(colors.ok, 0.15) : colors.surface2 }}
              >
                <Txt size={12} color={p.active ? colors.ok : colors.muted}>
                  {p.active ? 'Ativa' : 'Pausada'}
                </Txt>
              </Pressable>
            </Card>
          ))
        )}
      </View>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && <PunishmentForm initial={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </Screen>
  )
}

function PunishmentForm({ initial, onDone }: { initial: Partial<Punishment>; onDone: () => void }) {
  const { group } = useGroup()
  const save = useSavePunishment(group.id)
  const remove = useDeletePunishment()
  const toast = useToast()
  const [kind, setKind] = useState(initial.kind ?? KINDS[0])
  const [description, setDescription] = useState(initial.description ?? '')

  function submit() {
    if (!description.trim()) return toast('Descreva o que a pessoa tem que fazer', 'error')
    save.mutate({ id: initial.id, kind: kind.trim(), description: description.trim() }, { onSuccess: onDone, onError: (err) => toast(errorMessage(err), 'error') })
  }

  return (
    <View style={{ gap: 16 }}>
      <Txt size={18} weight="600">
        {initial.id ? 'Editar punição' : 'Nova punição'}
      </Txt>
      <Field label="Tipo">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {KINDS.map((k) => (
            <Chip key={k} label={k} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
      </Field>
      <Field label="O que a pessoa tem que fazer">
        <Input value={description} onChangeText={setDescription} multiline maxLength={200} />
      </Field>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {initial.id && (
          <Button
            variant="danger"
            loading={remove.isPending}
            onPress={async () => {
              if (!(await confirmAsync('Remover esta punição da roleta?', 'Remover', true))) return
              remove.mutate(initial.id!, { onSuccess: onDone, onError: (err) => toast(errorMessage(err), 'error') })
            }}
          >
            Remover
          </Button>
        )}
        <Button style={{ flex: 1 }} onPress={submit} loading={save.isPending}>
          Salvar
        </Button>
      </View>
    </View>
  )
}
