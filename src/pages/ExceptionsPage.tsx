import { useState } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Button, Card, Field, PageHeader, Spinner, cx, inputClass, useToast } from '@/components/ui'
import { useAddException, useCheckins, useExceptions, useJokers, useRemoveException, useRemoveJoker, useUseJoker } from '@/data/queries'
import { addDays, dayMonth, monthKey, monthLabel, weekRange, weekdayShort } from '@/domain/dates'
import { EXCEPTION_REASONS, type ExceptionReason } from '@/domain/rules'
import { errorMessage } from '@/lib/supabase'

export function ExceptionsPage() {
  const { group, userId, monday, nameOf } = useGroup()
  const until = addDays(monday, 13)
  const exceptions = useExceptions(group.id, monday, until)
  const checkins = useCheckins(group.id, monday, until)
  const jokers = useJokers(group.id)
  const add = useAddException(group.id)
  const remove = useRemoveException()
  const spendJoker = useUseJoker(group.id)
  const removeJoker = useRemoveJoker()
  const toast = useToast()

  const [day, setDay] = useState<string | null>(null)
  const [reason, setReason] = useState<ExceptionReason | null>(null)
  const [note, setNote] = useState('')

  const mine = (exceptions.data ?? []).filter((e) => e.user_id === userId)
  const others = (exceptions.data ?? []).filter((e) => e.user_id !== userId)
  const taken = new Set([
    ...mine.map((e) => e.day),
    ...(checkins.data ?? []).filter((c) => c.user_id === userId).map((c) => c.day),
  ])

  // Segunda a sexta desta semana e da próxima.
  const options = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11].map((i) => addDays(monday, i))

  const myJokers = (jokers.data ?? []).filter((j) => j.user_id === userId)
  const thisWeekJoker = myJokers.find((j) => j.week_start === monday)
  const usedThisMonth = myJokers.filter((j) => monthKey(j.week_start) === monthKey(monday))
  const jokerLeft = group.jokers_per_month - usedThisMonth.length

  function submit() {
    if (!day || !reason) return
    add.mutate(
      { day, reason, note },
      {
        onSuccess: () => {
          toast('Exceção marcada')
          setDay(null)
          setReason(null)
          setNote('')
        },
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    )
  }

  return (
    <div>
      <PageHeader title="Exceções e coringa" back="/mais" />
      <div className="space-y-4 px-4 pt-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">🃏 Coringa</h2>
              <p className="text-sm text-muted">
                {group.jokers_per_month} por mês. Cancela a punição da semana inteira e não acumula.
              </p>
            </div>
            <span className="whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-xs">
              {monthLabel(monday).split(' de ')[0]}: {Math.max(0, jokerLeft)} {jokerLeft === 1 ? 'restante' : 'restantes'}
            </span>
          </div>
          <div className="mt-3">
            {jokers.isLoading ? null : thisWeekJoker ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-warn/10 p-3 text-sm text-warn">
                Coringa usado na semana {weekRange(monday)}
                <Button
                  variant="ghost"
                  className="!min-h-8 !px-2 !py-1"
                  loading={removeJoker.isPending}
                  onClick={() => removeJoker.mutate(thisWeekJoker.id, { onError: (err) => toast(errorMessage(err), 'error') })}
                >
                  Desfazer
                </Button>
              </div>
            ) : jokerLeft > 0 ? (
              <Button
                variant="secondary"
                className="w-full"
                loading={spendJoker.isPending}
                onClick={() => {
                  if (!confirm(`Usar o coringa na semana ${weekRange(monday)}? Você não leva punição nesta semana.`)) return
                  spendJoker.mutate(monday, {
                    onSuccess: () => toast('Coringa usado. Semana salva!'),
                    onError: (err) => toast(errorMessage(err), 'error'),
                  })
                }}
              >
                Usar coringa nesta semana
              </Button>
            ) : (
              <p className="text-sm text-muted">
                Coringa deste mês já usado
                {usedThisMonth[0] && <> na semana {weekRange(usedThisMonth[0].week_start)}</>}.
              </p>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">🩹 Marcar exceção</h2>
            <p className="text-sm text-muted">
              Cada dia útil justificado tira 1 da sua meta da semana. Fica visível no feed.
            </p>
          </div>

          <Field label="Dia">
            <div className="grid grid-cols-5 gap-1.5">
              {options.map((d) => {
                const disabled = taken.has(d)
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => setDay(d)}
                    className={cx(
                      'rounded-xl py-2 text-center text-xs disabled:opacity-30',
                      day === d ? 'bg-accent text-accent-ink' : 'bg-surface-2',
                    )}
                  >
                    <span className="block uppercase">{weekdayShort(d)}</span>
                    <span className="block font-semibold">{dayMonth(d)}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Motivo">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(EXCEPTION_REASONS) as ExceptionReason[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cx('rounded-xl py-2.5 text-sm', reason === r ? 'bg-accent text-accent-ink' : 'bg-surface-2')}
                >
                  {EXCEPTION_REASONS[r]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Observação (opcional)">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>

          <Button className="w-full" disabled={!day || !reason} loading={add.isPending} onClick={submit}>
            Marcar exceção
          </Button>
        </Card>

        {exceptions.isLoading ? (
          <Spinner />
        ) : (
          <>
            {mine.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted">Suas exceções</h3>
                {mine.map((e) => (
                  <Card key={e.id} className="flex items-center justify-between !py-3 text-sm">
                    <span>
                      {weekdayShort(e.day)} {dayMonth(e.day)} · <span className="text-warn">{EXCEPTION_REASONS[e.reason]}</span>
                    </span>
                    <button
                      className="text-xs text-muted"
                      onClick={() => remove.mutate(e.id, { onError: (err) => toast(errorMessage(err), 'error') })}
                    >
                      Remover
                    </button>
                  </Card>
                ))}
              </div>
            )}
            {others.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted">Do grupo</h3>
                {others.map((e) => (
                  <Card key={e.id} className="!py-3 text-sm">
                    <b>{nameOf(e.user_id)}</b>: {weekdayShort(e.day)} {dayMonth(e.day)} ·{' '}
                    <span className="text-warn">{EXCEPTION_REASONS[e.reason]}</span>
                    {e.note && <span className="text-muted"> · {e.note}</span>}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
