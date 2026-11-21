import type { CheckinKind } from '@domain/reactions'
import type { ExceptionReason } from '@domain/rules'

export interface Profile {
  id: string
  display_name: string
}

export interface Group {
  id: string
  name: string
  invite_code: string
  weekly_goal: number
  fine_min: number
  fine_max: number
  sunday_counts: boolean
  jokers_per_month: number
  timezone: string
  starts_on: string
  require_location: boolean
}

export interface KittyGoal {
  id: string
  group_id: string
  title: string
  target_amount: number
  created_by: string | null
  created_at: string
  completed_at: string | null
  withdrawal_id: string | null
}

export type GroupRulesUpdate = Pick<
  Group,
  'name' | 'weekly_goal' | 'fine_min' | 'fine_max' | 'sunday_counts' | 'jokers_per_month' | 'require_location'
>

export interface Member {
  group_id: string
  user_id: string
  role: 'owner' | 'member'
  starts_on: string
  joined_at: string
  display_name: string
}

export interface Checkin {
  id: string
  group_id: string
  user_id: string
  day: string
  photo_path: string
  created_at: string
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  gym_id: string | null
  gym_name: string | null
  distance_m: number | null
  kind: CheckinKind | null
}

export interface CheckinReport {
  id: string
  group_id: string
  checkin_id: string
  author_id: string | null
  reporter_id: string | null
  day: string
  reason: string
  photo_path: string
  gym_name: string | null
  distance_m: number | null
  created_at: string
}

export interface Reaction {
  id: string
  checkin_id: string
  group_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface Gym {
  id: string
  group_id: string
  name: string
  address: string | null
  place_id: string | null
  lat: number
  lng: number
  created_by: string | null
  created_at: string
}

export interface ExceptionDay {
  id: string
  group_id: string
  user_id: string
  day: string
  reason: ExceptionReason
  note: string | null
  created_at: string
  /** Quando o parceiro aprovou (nulo = sem resposta ainda). Pode faltar antes da migração da leva 2. */
  reviewed_by?: string | null
  reviewed_at?: string | null
}

export interface ExceptionRejection {
  id: string
  group_id: string
  exception_id: string
  author_id: string | null
  rejected_by: string | null
  day: string
  reason: ExceptionReason
  note: string | null
  why: string | null
  created_at: string
}

export interface Reward {
  id: string
  group_id: string
  description: string
  active: boolean
  created_at: string
}

export interface RewardSpin {
  id: string
  group_id: string
  week_start: string
  reward_id: string | null
  reward_text: string
  spun_by: string | null
  created_at: string
  redeemed_at: string | null
}

export type PlanPeriod = 'manha' | 'tarde' | 'noite'

export interface WorkoutPlan {
  id: string
  group_id: string
  user_id: string
  day: string
  period: PlanPeriod | null
  created_at: string
}

export interface Nudge {
  id: string
  group_id: string
  from_user: string
  to_user: string
  created_at: string
  seen_at: string | null
}

export interface Joker {
  id: string
  group_id: string
  user_id: string
  week_start: string
  created_at: string
}

export interface Punishment {
  id: string
  group_id: string
  kind: string
  description: string
  active: boolean
  created_at: string
}

export interface Week {
  id: string
  group_id: string
  week_start: string
  closed_at: string
  fine_amount: number | null
  punishment_kind: string | null
  punishment_text: string | null
}

export interface KittyWithdrawal {
  id: string
  group_id: string
  amount: number
  description: string
  withdrawn_by: string | null
  created_at: string
}

export interface WeekResult {
  week_id: string
  group_id: string
  user_id: string
  week_start: string
  base_goal: number
  exception_days: number
  goal: number
  checkins: number
  used_joker: boolean
  met: boolean
  owes: boolean
  fine_amount: number
  punishment_text: string | null
  paid_at: string | null
  paid_marked_by: string | null
  task_done_at: string | null
}
