import { useState } from 'react'
import { Platform, Share, Switch, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Avatar, Button, Card, Chip, Field, Input, PageHeader, Screen, Txt, confirmAsync, memberColor, useToast } from '@/components/ui'
import { useCreateGroup, useJoinGroup, useLeaveGroup, useUpdateGroupRules, useUpdateMyName } from '@/data/queries'
import { dayMonth } from '@domain/dates'
import { GYM_RADIUS_M } from '@domain/geo'
import { inviteLink } from '@/lib/invite'
import { errorMessage } from '@/lib/supabase'
import { colors } from '@/lib/theme'

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' })

export function GroupSettingsScreen() {
  const { group, groups, members, userId, me, selectGroup } = useGroup()
  const update = useUpdateGroupRules(group.id)
  const rename = useUpdateMyName(userId)
  const join = useJoinGroup()
  const create = useCreateGroup()
  const leave = useLeaveGroup()
  const toast = useToast()

  const [form, setForm] = useState({
    name: group.name,
    weekly_goal: group.weekly_goal,
    fine_min: group.fine_min,
    fine_max: group.fine_max,
    sunday_counts: group.sunday_counts,
    jokers_per_month: group.jokers_per_month,
    require_location: group.require_location,
    exceptions_per_month: group.exceptions_per_month,
  })
  const [myName, setMyName] = useState(me?.display_name ?? '')
  const [code, setCode] = useState('')
  const [newGroup, setNewGroup] = useState('')

  const fail = (err: unknown) => toast(errorMessage(err), 'error')

  function saveRules() {
    if (!form.name.trim()) return toast('Informe o nome do grupo', 'error')
    // O navegador limitava os números pelos campos (min/max); aqui a conferência é feita ao salvar.
    const maxGoal = form.sunday_counts ? 7 : 6
    if (form.weekly_goal < 1 || form.weekly_goal > maxGoal) return toast(`A meta precisa ser de 1 a ${maxGoal} treinos`, 'error')
    if (form.jokers_per_month > 4) return toast('No máximo 4 coringas por mês', 'error')
    if (form.exceptions_per_month !== undefined && (form.exceptions_per_month < 1 || form.exceptions_per_month > 20))
      return toast('O limite de exceções precisa ser de 1 a 20 por mês', 'error')
    if (form.fine_max < form.fine_min) return toast('A multa máxima precisa ser maior que a mínima', 'error')
    // Antes da migração da leva 3 a coluna não existe: aí ela não vai no pedido.
    const { exceptions_per_month, ...rest } = form
    update.mutate(exceptions_per_month === undefined ? rest : form, { onSuccess: () => toast('Regras salvas'), onError: fail })
  }

  async function share() {
    const link = inviteLink(group.invite_code)
    const text = `Bora treinar! Entra no nosso grupo "${group.name}" no Treino a Dois: ${link} (código ${group.invite_code})`
    try {
      await Share.share({ message: text, title: 'Treino a Dois' })
    } catch {
      /* compartilhamento cancelado */
    }
  }

  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))

  return (
    <Screen header={<PageHeader title="Grupo e regras" back />}>
      <Card>
        <Txt weight="600">Convite</Txt>
        <Txt size={14} muted>
          Mande o link ou o código para quem vai entrar no grupo.
        </Txt>
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: colors.surface2, paddingVertical: 12 }}>
            <Txt size={24} center selectable style={{ fontFamily: MONO, letterSpacing: 7 }}>
              {group.invite_code}
            </Txt>
          </View>
          <Button onPress={share}>Compartilhar</Button>
        </View>
      </Card>

      <Card>
        <Txt weight="600" style={{ marginBottom: 12 }}>
          Membros
        </Txt>
        <View style={{ gap: 8 }}>
          {members.map((m, i) => (
            <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={m.display_name} color={memberColor(i)} size={30} />
              <Txt size={14} style={{ flex: 1 }}>
                {m.display_name}
              </Txt>
              <Txt size={12} muted>
                meta desde {dayMonth(m.starts_on)}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="Seu nome">
              <Input value={myName} onChangeText={setMyName} maxLength={40} />
            </Field>
          </View>
          <Button
            variant="secondary"
            loading={rename.isPending}
            onPress={() => {
              if (!myName.trim()) return toast('Informe seu nome', 'error')
              rename.mutate(myName, { onSuccess: () => toast('Nome atualizado'), onError: fail })
            }}
          >
            Salvar
          </Button>
        </View>
      </Card>

      <Card style={{ gap: 16 }}>
        <View>
          <Txt weight="600">Regras</Txt>
          <Txt size={12} muted>
            Mudanças valem para as semanas que ainda não fecharam.
          </Txt>
        </View>
        <Field label="Nome do grupo">
          <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} maxLength={60} />
        </Field>
        <Field label="Meta de treinos por semana">
          <Input keyboardType="number-pad" value={String(form.weekly_goal)} onChangeText={(v) => setForm({ ...form, weekly_goal: num(v) })} />
        </Field>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Multa mínima (R$)">
              <Input keyboardType="number-pad" value={String(form.fine_min)} onChangeText={(v) => setForm({ ...form, fine_min: num(v) })} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Multa máxima (R$)">
              <Input keyboardType="number-pad" value={String(form.fine_max)} onChangeText={(v) => setForm({ ...form, fine_max: num(v) })} />
            </Field>
          </View>
        </View>
        <Field label="Coringas por mês">
          <Input
            keyboardType="number-pad"
            value={String(form.jokers_per_month)}
            onChangeText={(v) => setForm({ ...form, jokers_per_month: num(v) })}
          />
        </Field>
        {form.exceptions_per_month !== undefined && (
          <Field label="Exceções por pessoa no mês" hint="Doença, viagem, lesão: cada pessoa marca no máximo isso por mês.">
            <Input
              keyboardType="number-pad"
              value={String(form.exceptions_per_month)}
              onChangeText={(v) => setForm({ ...form, exceptions_per_month: num(v) })}
            />
          </Field>
        )}
        <SwitchRow
          label="Treino no domingo conta"
          hint="Desligado: domingo é folga e o check-in fica bloqueado."
          value={form.sunday_counts}
          onChange={(v) => setForm({ ...form, sunday_counts: v })}
        />
        <SwitchRow
          label="Exigir estar na academia"
          hint={`Ligado: o GPS precisa estar a até ${GYM_RADIUS_M} m de uma academia cadastrada.`}
          value={form.require_location}
          onChange={(v) => setForm({ ...form, require_location: v })}
        />
        <Button onPress={saveRules} loading={update.isPending}>
          Salvar regras
        </Button>
      </Card>

      {groups.length > 1 && (
        <Card>
          <Txt weight="600" style={{ marginBottom: 8 }}>
            Seus grupos
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {groups.map((g) => (
              <Chip key={g.id} label={g.name} active={g.id === group.id} onPress={() => selectGroup(g.id)} />
            ))}
          </View>
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <Txt weight="600">Outro grupo</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Código"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ fontFamily: MONO }}
            />
          </View>
          <Button
            variant="secondary"
            loading={join.isPending}
            onPress={() => {
              if (!code.trim()) return toast('Informe o código', 'error')
              join.mutate(code, {
                onSuccess: (gid) => {
                  selectGroup(gid)
                  setCode('')
                  toast('Você entrou no grupo')
                },
                onError: fail,
              })
            }}
          >
            Entrar
          </Button>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input placeholder="Nome do novo grupo" value={newGroup} onChangeText={setNewGroup} maxLength={60} />
          </View>
          <Button
            variant="secondary"
            loading={create.isPending}
            onPress={() => {
              if (!newGroup.trim()) return toast('Informe o nome do grupo', 'error')
              create.mutate(newGroup, {
                onSuccess: (gid) => {
                  selectGroup(gid)
                  setNewGroup('')
                  toast('Grupo criado')
                },
                onError: fail,
              })
            }}
          >
            Criar
          </Button>
        </View>
      </Card>

      <Button
        variant="danger"
        loading={leave.isPending}
        onPress={async () => {
          if (!(await confirmAsync(`Sair do grupo "${group.name}"? Seu histórico continua salvo para os outros.`, 'Sair do grupo', true))) return
          leave.mutate(group.id, { onError: fail })
        }}
      >
        Sair do grupo
      </Button>
    </Screen>
  )
}

function SwitchRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt size={14}>{label}</Txt>
        <Txt size={12} muted>
          {hint}
        </Txt>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.line }}
        thumbColor={Platform.OS === 'android' ? colors.ink : undefined}
        accessibilityLabel={label}
      />
    </View>
  )
}
