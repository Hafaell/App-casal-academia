import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { catchUpWeeks, useMembers } from '@/data/queries'
import type { Group, Member } from '@/data/types'
import { localToday, mondayOf, type ISODate } from '@domain/dates'
import type { GroupRules } from '@domain/rules'
import { FullScreenMessage, Spinner } from '@/components/ui'
import { readLocal, writeLocal } from '@/lib/storage'

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

export function readSelectedGroup(): Promise<string | null> {
  return readLocal(SELECTED_KEY)
}

/** Atualiza "hoje" quando vira o dia com o app aberto ou quando ele volta do fundo. */
function useToday(timeZone: string): ISODate {
  const [today, setToday] = useState(() => localToday(timeZone))
  useEffect(() => {
    setToday(localToday(timeZone))
    const id = setInterval(() => setToday(localToday(timeZone)), 60_000)
    const sub = AppState.addEventListener('change', (state) => state === 'active' && setToday(localToday(timeZone)))
    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [timeZone])
  return today
}

export function GroupProvider({
  groups,
  userId,
  initialSelected,
  children,
}: {
  groups: Group[]
  userId: string
  /** Grupo escolhido da última vez (lido do aparelho antes de abrir). */
  initialSelected: string | null
  children: ReactNode
}) {
  const [selected, setSelected] = useState(initialSelected)
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
        void writeLocal(SELECTED_KEY, gid)
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
