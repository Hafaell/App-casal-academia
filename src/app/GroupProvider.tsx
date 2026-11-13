import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { catchUpWeeks, useMembers } from '@/data/queries'
import type { Group, Member } from '@/data/types'
import { localToday, mondayOf, type ISODate } from '@/domain/dates'
import type { GroupRules } from '@/domain/rules'
import { FullScreenMessage, Spinner } from '@/components/ui'

interface GroupContextValue {
  group: Group
  groups: Group[]
  members: Member[]
  userId: string
  me: Member | undefined
  rules: GroupRules
  today: ISODate
  monday: ISODate
  nameOf: (userId: string) => string
  selectGroup: (gid: string) => void
}

const GroupContext = createContext<GroupContextValue | null>(null)

const SELECTED_KEY = 'treino:grupo'

export function readSelectedGroup(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

function writeSelectedGroup(gid: string) {
  try {
    localStorage.setItem(SELECTED_KEY, gid)
  } catch {
    /* sem armazenamento local: tudo bem, usa o primeiro grupo */
  }
}

/** Atualiza "hoje" quando vira o dia com o app aberto. */
function useToday(timeZone: string): ISODate {
  const [today, setToday] = useState(() => localToday(timeZone))
  useEffect(() => {
    setToday(localToday(timeZone))
    const id = setInterval(() => setToday(localToday(timeZone)), 60_000)
    const onVisible = () => document.visibilityState === 'visible' && setToday(localToday(timeZone))
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [timeZone])
  return today
}

export function GroupProvider({
  groups,
  userId,
  children,
}: {
  groups: Group[]
  userId: string
  children: ReactNode
}) {
  const [selected, setSelected] = useState(() => readSelectedGroup())
  const group = groups.find((g) => g.id === selected) ?? groups[0]
  const members = useMembers(group.id)
  const today = useToday(group.timezone)
  const qc = useQueryClient()

  // Ao abrir o app (e ao virar a semana), garante que semanas vencidas foram fechadas.
  const caughtUp = useRef<string | null>(null)
  const monday = mondayOf(today)
  useEffect(() => {
    const key = `${group.id}:${monday}`
    if (caughtUp.current === key) return
    caughtUp.current = key
    catchUpWeeks(group.id)
      .then((n) => {
        if (n > 0) {
          qc.invalidateQueries({ queryKey: ['weeks'] })
          qc.invalidateQueries({ queryKey: ['results'] })
        }
      })
      .catch(() => {
        /* o agendamento do banco cobre */
      })
  }, [group.id, monday, qc])

  const value = useMemo<GroupContextValue | null>(() => {
    if (!members.data) return null
    const names = new Map(members.data.map((m) => [m.user_id, m.display_name]))
    return {
      group,
      groups,
      members: members.data,
      userId,
      me: members.data.find((m) => m.user_id === userId),
      rules: { weeklyGoal: group.weekly_goal, sundayCounts: group.sunday_counts },
      today,
      monday,
      nameOf: (id) => names.get(id) ?? 'Alguém',
      selectGroup: (gid) => {
        writeSelectedGroup(gid)
        setSelected(gid)
      },
    }
  }, [group, groups, members.data, userId, today, monday])

  if (members.error) return <FullScreenMessage title="Não foi possível carregar o grupo" detail={String(members.error)} />
  if (!value) return <Spinner fullScreen />

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup fora do GroupProvider')
  return ctx
}
