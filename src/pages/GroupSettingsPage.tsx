import { useState, type FormEvent } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Avatar, Button, Card, Field, PageHeader, cx, inputClass, memberColor, useToast } from '@/components/ui'
import { useCreateGroup, useJoinGroup, useLeaveGroup, useUpdateGroupRules, useUpdateMyName } from '@/data/queries'
import { dayMonth } from '@/domain/dates'
import { GYM_RADIUS_M } from '@/domain/geo'
import { inviteLink } from '@/lib/invite'
import { errorMessage } from '@/lib/supabase'

export function GroupSettingsPage() {
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
  })
  const [myName, setMyName] = useState(me?.display_name ?? '')
  const [code, setCode] = useState('')
  const [newGroup, setNewGroup] = useState('')

  const fail = (err: unknown) => toast(errorMessage(err), 'error')

  function saveRules(e: FormEvent) {
    e.preventDefault()
    if (form.fine_max < form.fine_min) return toast('A multa máxima precisa ser maior que a mínima', 'error')
    update.mutate(form, { onSuccess: () => toast('Regras salvas'), onError: fail })
  }

  async function share() {
    const link = inviteLink(group.invite_code)
    const text = `Bora treinar! Entra no nosso grupo "${group.name}" no Treino a Dois: ${link} (código ${group.invite_code})`
    try {
      if (navigator.share) await navigator.share({ title: 'Treino a Dois', text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Convite copiado')
      }
    } catch {
      /* compartilhamento cancelado */
    }
  }

  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))

  return (
    <div>
      <PageHeader title="Grupo e regras" back="/mais" />
      <div className="space-y-4 px-4 pt-4">
        <Card>
          <h2 className="font-semibold">Convite</h2>
          <p className="text-sm text-muted">Mande o link ou o código para quem vai entrar no grupo.</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex-1 rounded-xl bg-surface-2 py-3 text-center font-mono text-2xl tracking-[0.3em]">
              {group.invite_code}
            </span>
            <Button onClick={share}>Compartilhar</Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Membros</h2>
          <ul className="space-y-2">
            {members.map((m, i) => (
              <li key={m.user_id} className="flex items-center gap-3 text-sm">
                <Avatar name={m.display_name} color={memberColor(i)} size={30} />
                <span className="flex-1">{m.display_name}</span>
                <span className="text-xs text-muted">meta desde {dayMonth(m.starts_on)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              rename.mutate(myName, { onSuccess: () => toast('Nome atualizado'), onError: fail })
            }}
          >
            <div className="flex-1">
              <Field label="Seu nome">
                <input className={inputClass} value={myName} onChange={(e) => setMyName(e.target.value)} maxLength={40} required />
              </Field>
            </div>
            <Button type="submit" variant="secondary" loading={rename.isPending}>
              Salvar
            </Button>
          </form>
        </Card>

        <Card>
          <form onSubmit={saveRules} className="space-y-4">
            <h2 className="font-semibold">Regras</h2>
            <p className="-mt-2 text-xs text-muted">Mudanças valem para as semanas que ainda não fecharam.</p>
            <Field label="Nome do grupo">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} required />
            </Field>
            <Field label="Meta de treinos por semana">
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                min={1}
                max={form.sunday_counts ? 7 : 6}
                value={form.weekly_goal}
                onChange={(e) => setForm({ ...form, weekly_goal: num(e.target.value) })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Multa mínima (R$)">
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.fine_min}
                  onChange={(e) => setForm({ ...form, fine_min: num(e.target.value) })}
                />
              </Field>
              <Field label="Multa máxima (R$)">
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min={form.fine_min}
                  value={form.fine_max}
                  onChange={(e) => setForm({ ...form, fine_max: num(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Coringas por mês">
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                min={0}
                max={4}
                value={form.jokers_per_month}
                onChange={(e) => setForm({ ...form, jokers_per_month: num(e.target.value) })}
              />
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Treino no domingo conta
                <span className="block text-xs text-muted">Desligado: domingo é folga e o check-in fica bloqueado.</span>
              </span>
              <input
                type="checkbox"
                className="h-6 w-6 accent-[#c6f432]"
                checked={form.sunday_counts}
                onChange={(e) => setForm({ ...form, sunday_counts: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Exigir estar na academia
                <span className="block text-xs text-muted">Ligado: o GPS precisa estar a até {GYM_RADIUS_M} m de uma academia cadastrada.</span>
              </span>
              <input
                type="checkbox"
                className="h-6 w-6 accent-[#c6f432]"
                checked={form.require_location}
                onChange={(e) => setForm({ ...form, require_location: e.target.checked })}
              />
            </label>
            <Button type="submit" className="w-full" loading={update.isPending}>
              Salvar regras
            </Button>
          </form>
        </Card>

        {groups.length > 1 && (
          <Card>
            <h2 className="mb-2 font-semibold">Seus grupos</h2>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectGroup(g.id)}
                  className={cx('rounded-full px-3 py-1.5 text-sm', g.id === group.id ? 'bg-accent text-accent-ink' : 'bg-surface-2')}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card className="space-y-3">
          <h2 className="font-semibold">Outro grupo</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
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
            <input
              className={`${inputClass} font-mono uppercase`}
              placeholder="Código"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
            />
            <Button type="submit" variant="secondary" loading={join.isPending}>
              Entrar
            </Button>
          </form>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
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
            <input className={inputClass} placeholder="Nome do novo grupo" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} maxLength={60} required />
            <Button type="submit" variant="secondary" loading={create.isPending}>
              Criar
            </Button>
          </form>
        </Card>

        <Button
          variant="danger"
          className="w-full"
          loading={leave.isPending}
          onClick={() => {
            if (!confirm(`Sair do grupo "${group.name}"? Seu histórico continua salvo para os outros.`)) return
            leave.mutate(group.id, { onError: fail })
          }}
        >
          Sair do grupo
        </Button>
      </div>
    </div>
  )
}
