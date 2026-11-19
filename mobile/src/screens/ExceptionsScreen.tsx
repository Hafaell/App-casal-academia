import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, Chip, Field, Input, PageHeader, Screen, Spinner, Txt, confirmAsync, useToast } from '@/components/ui'
import { useAddException, useCheckins, useExceptions, useJokers, useRemoveException, useRemoveJoker, useUseJoker } from '@/data/queries'
import { addDays, dayMonth, monthKey, monthLabel, weekRange, weekdayShort } from '@domain/dates'
import { EXCEPTION_REASONS, type ExceptionReason } from '@domain/rules'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

export function ExceptionsScreen() {
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
  const taken = new Set([...mine.map((e) => e.day), ...(checkins.data ?? []).filter((c) => c.user_id === userId).map((c) => c.day)])

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
    <Screen header={<PageHeader title="Exceções e coringa" back />}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt weight="600">🃏 Coringa</Txt>
            <Txt size={14} muted>
              {group.jokers_per_month} por mês. Cancela a punição da semana inteira e não acumula.
            </Txt>
          </View>
          <View style={{ borderRadius: 999, backgroundColor: colors.surface2, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Txt size={12}>
              {monthLabel(monday).split(' de ')[0]}: {Math.max(0, jokerLeft)} {jokerLeft === 1 ? 'restante' : 'restantes'}
            </Txt>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          {jokers.isLoading ? null : thisWeekJoker ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                borderRadius: 12,
                backgroundColor: alpha(colors.warn, 0.1),
                padding: 12,
              }}
            >
              <Txt size={14} color={colors.warn} style={{ flex: 1 }}>
                Coringa usado na semana {weekRange(monday)}
              </Txt>
              <Button
                variant="ghost"
                style={{ minHeight: 32, paddingHorizontal: 8, paddingVertical: 4 }}
                loading={removeJoker.isPending}
                onPress={() => removeJoker.mutate(thisWeekJoker.id, { onError: (err) => toast(errorMessage(err), 'error') })}
              >
                Desfazer
              </Button>
            </View>
          ) : jokerLeft > 0 ? (
            <Button
              variant="secondary"
              loading={spendJoker.isPending}
              onPress={async () => {
                if (!(await confirmAsync(`Usar o coringa na semana ${weekRange(monday)}? Você não leva punição nesta semana.`, 'Usar coringa'))) return
                spendJoker.mutate(monday, {
                  onSuccess: () => toast('Coringa usado. Semana salva!'),
                  onError: (err) => toast(errorMessage(err), 'error'),
                })
              }}
            >
              Usar coringa nesta semana
            </Button>
          ) : (
            <Txt size={14} muted>
              Coringa deste mês já usado
              {usedThisMonth[0] ? ` na semana ${weekRange(usedThisMonth[0].week_start)}` : ''}.
            </Txt>
          )}
        </View>
      </Card>

      <Card style={{ gap: 16 }}>
        <View>
          <Txt weight="600">🩹 Marcar exceção</Txt>
          <Txt size={14} muted>
            Cada dia útil justificado tira 1 da sua meta da semana. Fica visível no feed.
          </Txt>
        </View>

        <Field label="Dia">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {options.map((d) => {
              const disabled = taken.has(d)
              const selected = day === d
              return (
                <Pressable
                  key={d}
                  disabled={disabled}
                  onPress={() => setDay(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  style={{
                    width: '18.4%',
                    borderRadius: 12,
                    paddingVertical: 8,
                    backgroundColor: selected ? colors.accent : colors.surface2,
                    opacity: disabled ? 0.3 : 1,
                  }}
                >
                  <Txt size={12} center color={selected ? colors.accentInk : colors.ink} style={{ textTransform: 'uppercase' }}>
                    {weekdayShort(d)}
                  </Txt>
                  <Txt size={12} weight="600" center color={selected ? colors.accentInk : colors.ink}>
                    {dayMonth(d)}
                  </Txt>
                </Pressable>
              )
            })}
          </View>
        </Field>

        <Field label="Motivo">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(EXCEPTION_REASONS) as ExceptionReason[]).map((r) => (
              <Chip
                key={r}
                label={EXCEPTION_REASONS[r]}
                active={reason === r}
                onPress={() => setReason(r)}
                style={{ width: '48.5%', borderRadius: 12, paddingVertical: 10 }}
              />
            ))}
          </View>
        </Field>

        <Field label="Observação (opcional)">
          <Input value={note} onChangeText={setNote} maxLength={200} />
        </Field>

        <Button disabled={!day || !reason} loading={add.isPending} onPress={submit}>
          Marcar exceção
        </Button>
      </Card>

      {exceptions.isLoading ? (
        <Spinner />
      ) : (
        <>
          {mine.length > 0 && (
            <View style={{ gap: 8 }}>
              <Txt size={14} weight="600" muted>
                Suas exceções
              </Txt>
              {mine.map((e) => (
                <Card key={e.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
                  <Txt size={14}>
                    {weekdayShort(e.day)} {dayMonth(e.day)} · <Txt size={14} color={colors.warn}>{EXCEPTION_REASONS[e.reason]}</Txt>
                  </Txt>
                  <Pressable onPress={() => remove.mutate(e.id, { onError: (err) => toast(errorMessage(err), 'error') })} hitSlop={8} accessibilityRole="button">
                    <Txt size={12} muted>
                      Remover
                    </Txt>
                  </Pressable>
                </Card>
              ))}
            </View>
          )}
          {others.length > 0 && (
            <View style={{ gap: 8 }}>
              <Txt size={14} weight="600" muted>
                Do grupo
              </Txt>
              {others.map((e) => (
                <Card key={e.id} style={{ paddingVertical: 12 }}>
                  <Txt size={14}>
                    <Txt size={14} weight="700">
                      {nameOf(e.user_id)}
                    </Txt>
                    : {weekdayShort(e.day)} {dayMonth(e.day)} · <Txt size={14} color={colors.warn}>{EXCEPTION_REASONS[e.reason]}</Txt>
                    {e.note ? <Txt size={14} muted>{` · ${e.note}`}</Txt> : null}
                  </Txt>
                </Card>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  )
}
