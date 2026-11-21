/**
 * Stories e colagens: imagens prontas para compartilhar (Instagram, WhatsApp).
 * Separada do relatório do mês (Nossa história). Cada botão monta a imagem e já abre o compartilhar.
 */
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Card, PageHeader, Screen, Spinner, Txt, memberColor } from '@/components/ui'
import { MonthPicker } from '@/components/MonthPicker'
import { ShareImageButton } from '@/components/ShareImageButton'
import { useCheckins, usePhotoUrls, useWeekResults } from '@/data/queries'
import type { Checkin } from '@/data/types'
import { firstOfMonth, monthLabel, monthName } from '@domain/dates'
import { monthReport, pickYearPhotos, yearSummary } from '@domain/report'
import { groupStreak } from '@domain/streak'
import { findTogether } from '@domain/together'
import { plural } from '@/screens/StoryScreen'
import { colors } from '@/lib/theme'

const PINK = '#f472b6'
const BLUE = '#38bdf8'

export function ShareScreen() {
  const { group, members, today } = useGroup()
  const [month, setMonth] = useState(firstOfMonth(today))
  const year = month.slice(0, 4)
  const monthKey = month.slice(0, 7)

  const checkins = useCheckins(group.id, `${year}-01-01`, `${year}-12-31`)
  const results = useWeekResults(group.id)
  const memberKey = members.map((m) => m.user_id).join()
  const all = checkins.data ?? []

  const report = useMemo(
    () => monthReport({ month, memberIds: memberKey.split(','), checkins: all, results: results.data ?? [], timeZone: group.timezone }),
    [month, memberKey, all, results.data, group.timezone],
  )
  const yearly = useMemo(() => yearSummary(year, all, results.data ?? []), [year, all, results.data])
  const streak = useMemo(
    () => groupStreak((results.data ?? []).map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker }))),
    [results.data],
  )

  // Fotos de cada imagem: treinos a dois do mês, treinos do mês e o ano todo.
  const monthCheckins = useMemo(() => all.filter((c) => c.day.startsWith(monthKey)), [all, monthKey])
  const togetherPhotos = useMemo(() => {
    const ids = findTogether(monthCheckins).checkinIds
    return pickYearPhotos(year, monthCheckins.filter((c) => ids.has(c.id)), 6)
  }, [year, monthCheckins])
  const monthPhotos = useMemo(() => pickYearPhotos(year, monthCheckins, 6), [year, monthCheckins])
  const yearPhotos = useMemo(() => pickYearPhotos(year, all, 12), [year, all])
  const photos = usePhotoUrls([...togetherPhotos, ...monthPhotos, ...yearPhotos].map((c) => c.photo_path))
  const urlsOf = (list: Checkin[]) => list.map((c) => photos.data?.get(c.photo_path)).filter((u): u is string => Boolean(u))

  const names = members.map((m) => m.display_name.split(' ')[0]).join(' e ')
  const couple = members.length === 2 ? 'os dois' : 'todo mundo'
  const colorOf = (userId: string) => memberColor(members.findIndex((m) => m.user_id === userId))
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.display_name ?? 'Alguém'

  return (
    <Screen header={<PageHeader title="Stories e colagens" subtitle="Imagens para compartilhar" back />}>
      <MonthPicker month={month} onChange={setMonth} />

      {checkins.isLoading || results.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Item
            title="💑 Story: treinamos juntos"
            detail={`${plural(report.together, 'treino juntos', 'treinos juntos')} em ${monthName(month)} · ${streak.current} ${
              streak.current === 1 ? 'semana seguida' : 'semanas seguidas'
            }`}
          >
            {report.together === 0 ? (
              <Txt size={14} muted style={{ marginTop: 8 }}>
                Ainda não há treino a dois neste mês.
              </Txt>
            ) : (
              <ShareImageButton
                variant="primary"
                label="📤 Compartilhar story"
                dialogTitle="Treinamos juntos"
                build={() => ({
                  format: 'story',
                  title: 'Treino a Dois',
                  subtitle: names,
                  highlight: { value: String(report.together), label: `${report.together === 1 ? 'treino juntos' : 'treinos juntos'} em ${monthName(month)}` },
                  photos: urlsOf(togetherPhotos),
                  lines: [
                    { name: 'Sequência do casal', color: colors.accent, text: `🔥 ${streak.current}` },
                    { name: `Juntos em ${year}`, color: PINK, text: String(yearly.together) },
                  ],
                  footer: 'Treino a Dois',
                })}
              />
            )}
          </Item>

          <Item title="📅 Story do mês" detail={`${monthLabel(month)} · ${plural(report.checkins, 'treino', 'treinos')} · ${report.weeksAllMet}/${report.weeks} semanas batidas`}>
            {report.checkins === 0 ? (
              <Txt size={14} muted style={{ marginTop: 8 }}>
                Nenhum treino neste mês.
              </Txt>
            ) : (
              <ShareImageButton
                variant="primary"
                label="📤 Compartilhar story"
                dialogTitle={`Story de ${monthName(month)}`}
                build={() => ({
                  format: 'story',
                  title: monthLabel(month),
                  subtitle: `${report.weeksAllMet}/${report.weeks} semanas que ${couple} bateram`,
                  highlight: { value: String(report.checkins), label: 'treinos no mês' },
                  photos: urlsOf(monthPhotos),
                  lines: report.people.slice(0, 2).map((p) => ({ name: nameOf(p.userId), color: colorOf(p.userId), text: plural(p.checkins, 'treino', 'treinos') })),
                  footer: 'Treino a Dois',
                })}
              />
            )}
          </Item>

          <Item
            title={`🖼️ Colagem de ${year}`}
            detail={`Até 12 fotos do ano, espalhadas pelos meses, com preferência para os treinos a dois · ${plural(yearly.checkins, 'treino', 'treinos')}`}
          >
            {yearPhotos.length === 0 ? (
              <Txt size={14} muted style={{ marginTop: 8 }}>
                Ainda não há fotos neste ano.
              </Txt>
            ) : (
              <ShareImageButton
                variant="primary"
                label="📤 Compartilhar colagem"
                dialogTitle={`Colagem de ${year}`}
                build={() => ({
                  format: 'story',
                  columns: 4,
                  title: `Nosso ${year}`,
                  subtitle: names,
                  photos: urlsOf(yearPhotos),
                  lines: [
                    { name: 'Treinos', color: colors.accent, text: String(yearly.checkins) },
                    { name: 'Treinos juntos', color: PINK, text: String(yearly.together) },
                    { name: 'Semanas batidas', color: BLUE, text: String(yearly.weeksAllMet) },
                  ],
                  footer: 'Treino a Dois',
                })}
              />
            )}
          </Item>

          <Txt size={12} muted center>
            As imagens são montadas no celular e só saem dele quando você escolhe onde compartilhar.
          </Txt>
        </>
      )}
    </Screen>
  )
}

function Item({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <Card>
      <View>
        <Txt size={16} weight="700">
          {title}
        </Txt>
        <Txt size={12} muted style={{ marginTop: 4 }}>
          {detail}
        </Txt>
      </View>
      {children}
    </Card>
  )
}
