import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Avatar, Button, Card, PageHeader, PhotoViewer, Screen, Spinner, Txt, memberColor, useToast } from '@/components/ui'
import { useCheckins, usePhotoUrls, useWeekResults } from '@/data/queries'
import type { Checkin } from '@/data/types'
import { addMonths, firstOfMonth, monthLabel, weekdayLong } from '@domain/dates'
import { DAY_PERIOD_LABEL, monthReport, pickYearPhotos, yearSummary } from '@domain/report'
import { formatMoney } from '@domain/rules'
import { groupStreak } from '@domain/streak'
import { buildSummaryCard, shareImage, type SummaryCardData, type SummaryCard } from '@/lib/summaryCard'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

/** Dia (de 2026-11-16 a 2026-11-22) que cai no dia da semana pedido, só para escrever o nome. */
const dowName = (dow: number) => weekdayLong(`2026-11-${String(15 + dow).padStart(2, '0')}`)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function StoryScreen() {
  const { group, members, today } = useGroup()
  const thisMonth = firstOfMonth(today)
  const [month, setMonth] = useState(thisMonth)
  const year = month.slice(0, 4)

  const checkins = useCheckins(group.id, `${year}-01-01`, `${year}-12-31`)
  const results = useWeekResults(group.id)
  const memberIds = members.map((m) => m.user_id)

  const report = useMemo(
    () => monthReport({ month, memberIds, checkins: checkins.data ?? [], results: results.data ?? [], timeZone: group.timezone }),
    // memberIds muda de referência a cada render; o que importa é a lista de ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, memberIds.join(), checkins.data, results.data, group.timezone],
  )
  const year_ = useMemo(() => yearSummary(year, checkins.data ?? [], results.data ?? []), [year, checkins.data, results.data])
  const streak = useMemo(
    () => groupStreak((results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker }))),
    [results.data],
  )

  const monthPhotos = useMemo(
    () => pickYearPhotos(year, (checkins.data ?? []).filter((c) => c.day.startsWith(month.slice(0, 7))), 6),
    [year, month, checkins.data],
  )
  const yearPhotos = useMemo(() => pickYearPhotos(year, checkins.data ?? [], 12), [year, checkins.data])
  const photos = usePhotoUrls([...monthPhotos, ...yearPhotos].map((c) => c.photo_path))
  const urlsOf = (list: Checkin[]) => list.map((c) => photos.data?.get(c.photo_path)).filter((u): u is string => Boolean(u))

  const couple = members.length === 2 ? 'os dois' : 'todo mundo'
  const colorOf = (userId: string) => memberColor(members.findIndex((m) => m.user_id === userId))
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.display_name ?? 'Alguém'

  return (
    <Screen header={<PageHeader title="Nossa história" subtitle={group.name} back />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <MonthArrow label="‹" a11y="Mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
        <Txt size={18} weight="700">
          {monthLabel(month)}
        </Txt>
        <MonthArrow label="›" a11y="Próximo mês" disabled={month >= thisMonth} onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      {checkins.isLoading || results.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Card style={{ alignItems: 'center', borderColor: alpha(colors.accent, 0.4), backgroundColor: alpha(colors.accent, 0.05) }}>
            <Txt size={14} muted>
              Treinaram juntos
            </Txt>
            <Txt size={44} weight="700">
              💑 {report.together}
            </Txt>
            <Txt size={12} muted center>
              Mesmo dia, até 200 m um do outro e até 3 horas de diferença
            </Txt>
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Stat label="Treinos no mês" value={String(report.checkins)} />
            <Stat label={`Semanas que ${couple} bateram`} value={`${report.weeksAllMet}/${report.weeks}`} />
            <Stat label="Multas do mês" value={formatMoney(report.fines)} />
            <Stat label="Sequência atual" value={`🔥 ${streak.current}`} />
          </View>

          {(report.bestWeekday || report.bestPeriod) && (
            <Card>
              {report.bestWeekday && (
                <Txt size={14}>
                  📅 Dia preferido: <Txt size={14} weight="700">{dowName(report.bestWeekday.dow)}</Txt> ({plural(report.bestWeekday.count, 'treino', 'treinos')})
                </Txt>
              )}
              {report.bestPeriod && (
                <Txt size={14} style={{ marginTop: 4 }}>
                  🕒 Mais treinam <Txt size={14} weight="700">{DAY_PERIOD_LABEL[report.bestPeriod.period]}</Txt> ({plural(report.bestPeriod.count, 'treino', 'treinos')})
                </Txt>
              )}
            </Card>
          )}

          <Card>
            <View style={{ gap: 12 }}>
              {report.people.map((p) => (
                <View key={p.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={nameOf(p.userId)} color={colorOf(p.userId)} size={32} />
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="600">
                      {nameOf(p.userId)}
                    </Txt>
                    <Txt size={12} muted>
                      Bateu {p.weeksMet}/{p.weeks} {p.weeks === 1 ? 'semana' : 'semanas'}
                      {p.fines > 0 ? ` · multas ${formatMoney(p.fines)}` : ''}
                    </Txt>
                  </View>
                  <Txt size={18} weight="700">
                    {plural(p.checkins, 'treino', 'treinos')}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>

          <ShareCardButton
            key={`mes-${month}`}
            label="📤 Compartilhar o mês"
            dialogTitle="Compartilhar o mês"
            build={() => ({
              title: monthLabel(month),
              subtitle: `${plural(report.together, 'treino juntos', 'treinos juntos')} · ${report.weeksAllMet}/${report.weeks} semanas batidas`,
              photos: urlsOf(monthPhotos),
              lines: report.people.map((p) => ({ name: nameOf(p.userId), color: colorOf(p.userId), text: plural(p.checkins, 'treino', 'treinos') })),
              footer: 'Treino a Dois',
            })}
          />

          <Card style={{ marginTop: 8 }}>
            <Txt size={18} weight="700">
              Colagem de {year}
            </Txt>
            <Txt size={14} muted style={{ marginTop: 4 }}>
              {plural(year_.checkins, 'treino', 'treinos')} · {year_.together} juntos · {plural(year_.weeksAllMet, 'semana batida', 'semanas batidas')} por{' '}
              {couple}
            </Txt>
            <Txt size={12} muted style={{ marginTop: 4 }}>
              Até 12 fotos, espalhadas pelos meses, com preferência para os treinos a dois.
            </Txt>
            {yearPhotos.length === 0 ? (
              <Txt size={14} muted style={{ marginTop: 8 }}>
                Ainda não há fotos neste ano.
              </Txt>
            ) : (
              <ShareCardButton
                key={`ano-${year}`}
                label={`🖼️ Compartilhar a colagem de ${year}`}
                dialogTitle={`Compartilhar ${year}`}
                build={() => ({
                  title: `Nosso ${year}`,
                  subtitle: members.map((m) => m.display_name.split(' ')[0]).join(' e '),
                  columns: 4,
                  photos: urlsOf(yearPhotos),
                  lines: [
                    { name: 'Treinos', color: colors.accent, text: String(year_.checkins) },
                    { name: 'Treinos juntos', color: '#f472b6', text: String(year_.together) },
                    { name: 'Semanas batidas', color: '#38bdf8', text: String(year_.weeksAllMet) },
                  ],
                  footer: 'Treino a Dois',
                })}
              />
            )}
          </Card>
        </>
      )}
    </Screen>
  )
}

function MonthArrow({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      hitSlop={10}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}
    >
      <Txt size={28} weight="700">
        {label}
      </Txt>
    </Pressable>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Txt size={12} muted>
        {label}
      </Txt>
      <Txt size={22} weight="700">
        {value}
      </Txt>
    </Card>
  )
}

/** Toque 1: monta a imagem (demora, por causa das fotos). Toque 2: compartilha. */
function ShareCardButton({ label, dialogTitle, build }: { label: string; dialogTitle: string; build: () => SummaryCardData }) {
  const toast = useToast()
  const [preparing, setPreparing] = useState(false)
  const [card, setCard] = useState<SummaryCard | null>(null)
  const [viewing, setViewing] = useState(false)

  async function prepare() {
    setPreparing(true)
    try {
      setCard(await buildSummaryCard(build()))
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setPreparing(false)
    }
  }

  async function share() {
    if (!card) return
    try {
      if (!(await shareImage(card, dialogTitle))) setViewing(true)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <>
      <Button variant="ghost" style={{ marginTop: 8 }} textStyle={{ color: colors.accent }} onPress={card ? share : prepare} loading={preparing}>
        {preparing ? 'Preparando…' : card ? `${label} (pronto)` : label}
      </Button>
      <PhotoViewer url={viewing ? (card?.uri ?? null) : null} caption={dialogTitle} onClose={() => setViewing(false)} />
    </>
  )
}
