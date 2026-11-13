import { useState, type FormEvent } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Button, Card, EmptyState, Field, PageHeader, Sheet, Spinner, cx, inputClass, useToast } from '@/components/ui'
import { useDeletePunishment, usePunishments, useSavePunishment } from '@/data/queries'
import type { Punishment } from '@/data/types'
import { formatMoney } from '@/domain/rules'
import { errorMessage } from '@/lib/supabase'

const KINDS = ['Tarefa', 'Perda de escolha', 'Date', 'Constrangimento leve']

export function RoulettePage() {
  const { group } = useGroup()
  const punishments = usePunishments(group.id)
  const save = useSavePunishment(group.id)
  const [editing, setEditing] = useState<Partial<Punishment> | null>(null)
  const toast = useToast()

  const active = (punishments.data ?? []).filter((p) => p.active).length

  return (
    <div>
      <PageHeader
        title="Roleta"
        back="/mais"
        subtitle={`${active} ativas · multa de ${formatMoney(group.fine_min)} a ${formatMoney(group.fine_max)}`}
        right={
          <Button className="!min-h-9 !py-1.5" onClick={() => setEditing({ kind: KINDS[0], description: '' })}>
            + Nova
          </Button>
        }
      />
      <div className="space-y-2 px-4 pt-4">
        <p className="text-xs text-muted">
          No fechamento da semana, quem não bateu a meta recebe uma punição sorteada entre as ativas. Se mais de uma
          pessoa falhar, todas recebem a mesma.
        </p>
        {punishments.isLoading ? (
          <Spinner />
        ) : (punishments.data ?? []).length === 0 ? (
          <EmptyState>A roleta está vazia. Sem punições ativas, só a multa é sorteada.</EmptyState>
        ) : (
          (punishments.data ?? []).map((p) => (
            <Card key={p.id} className={cx('flex items-center gap-3 !py-3', !p.active && 'opacity-50')}>
              <button className="flex-1 text-left" onClick={() => setEditing(p)}>
                <span className="block text-xs text-muted">{p.kind}</span>
                <span className="block text-sm">{p.description}</span>
              </button>
              <button
                className={cx('rounded-full px-2.5 py-1 text-xs', p.active ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-muted')}
                onClick={() =>
                  save.mutate(
                    { id: p.id, kind: p.kind, description: p.description, active: !p.active },
                    { onError: (err) => toast(errorMessage(err), 'error') },
                  )
                }
              >
                {p.active ? 'Ativa' : 'Pausada'}
              </button>
            </Card>
          ))
        )}
      </div>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && <PunishmentForm initial={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

function PunishmentForm({ initial, onDone }: { initial: Partial<Punishment>; onDone: () => void }) {
  const { group } = useGroup()
  const save = useSavePunishment(group.id)
  const remove = useDeletePunishment()
  const toast = useToast()
  const [kind, setKind] = useState(initial.kind ?? KINDS[0])
  const [description, setDescription] = useState(initial.description ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(
      { id: initial.id, kind: kind.trim(), description: description.trim() },
      { onSuccess: onDone, onError: (err) => toast(errorMessage(err), 'error') },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="text-lg font-semibold">{initial.id ? 'Editar punição' : 'Nova punição'}</h3>
      <Field label="Tipo">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={cx('rounded-full px-3 py-1.5 text-sm', kind === k ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted')}
            >
              {k}
            </button>
          ))}
        </div>
      </Field>
      <Field label="O que a pessoa tem que fazer">
        <textarea
          className={cx(inputClass, 'min-h-24')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          maxLength={200}
        />
      </Field>
      <div className="flex gap-2">
        {initial.id && (
          <Button
            type="button"
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              if (!confirm('Remover esta punição da roleta?')) return
              remove.mutate(initial.id!, { onSuccess: onDone, onError: (err) => toast(errorMessage(err), 'error') })
            }}
          >
            Remover
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={save.isPending}>
          Salvar
        </Button>
      </div>
    </form>
  )
}
