import { useMemo } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { addDays, type ISODate } from '@/domain/dates'
import { weekProgress, type WeekProgress } from '@/domain/rules'
import { useCheckins, useExceptions, useJokers } from './queries'
import type { Checkin, ExceptionDay, Joker, Member } from './types'

export interface MemberWeek {
  member: Member
  progress: WeekProgress
  checkins: Checkin[]
  exceptions: ExceptionDay[]
  joker: Joker | undefined
}

/** Placar da semana atual, calculado com as mesmas regras do fechamento no banco. */
export function useWeekBoard(monday?: ISODate) {
  const { group, members, rules, today, monday: currentMonday } = useGroup()
  const start = monday ?? currentMonday
  const end = addDays(start, 6)
  const checkins = useCheckins(group.id, start, end)
  const exceptions = useExceptions(group.id, start, end)
  const jokers = useJokers(group.id)

  const board = useMemo<MemberWeek[] | undefined>(() => {
    if (!checkins.data || !exceptions.data || !jokers.data) return undefined
    return members.map((member) => {
      const mine = checkins.data.filter((c) => c.user_id === member.user_id)
      const myExceptions = exceptions.data.filter((e) => e.user_id === member.user_id)
      const joker = jokers.data.find((j) => j.user_id === member.user_id && j.week_start === start)
      return {
        member,
        checkins: mine,
        exceptions: myExceptions,
        joker,
        progress: weekProgress({
          rules,
          monday: start,
          today,
          checkinDays: mine.map((c) => c.day),
          exceptionDays: myExceptions.map((e) => e.day),
          usedJoker: Boolean(joker),
          startsOn: member.starts_on,
        }),
      }
    })
  }, [checkins.data, exceptions.data, jokers.data, members, rules, start, today])

  return {
    board,
    jokers: jokers.data,
    isLoading: checkins.isLoading || exceptions.isLoading || jokers.isLoading,
    error: checkins.error || exceptions.error || jokers.error,
  }
}
