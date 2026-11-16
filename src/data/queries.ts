import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PHOTO_BUCKET, supabase } from '@/lib/supabase'
import type { ExceptionReason } from '@/domain/rules'
import type {
  Checkin,
  ExceptionDay,
  Group,
  GroupRulesUpdate,
  Gym,
  Joker,
  Member,
  Punishment,
  Week,
  WeekResult,
} from './types'

/** Lança o erro do Supabase para o React Query tratar. */
function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

export const keys = {
  myGroups: ['my-groups'] as const,
  group: (gid: string) => ['group', gid] as const,
  members: (gid: string) => ['members', gid] as const,
  checkins: (gid: string, from: string, to: string) => ['checkins', gid, from, to] as const,
  exceptions: (gid: string, from: string, to: string) => ['exceptions', gid, from, to] as const,
  jokers: (gid: string) => ['jokers', gid] as const,
  weeks: (gid: string) => ['weeks', gid] as const,
  results: (gid: string) => ['results', gid] as const,
  punishments: (gid: string) => ['punishments', gid] as const,
  gyms: (gid: string) => ['gyms', gid] as const,
}

// ---------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------

export function useMyGroups(userId: string | undefined) {
  return useQuery({
    queryKey: keys.myGroups,
    enabled: Boolean(userId),
    queryFn: async () => {
      const rows = must(
        await supabase.from('group_members').select('group_id, joined_at').eq('user_id', userId!).order('joined_at'),
      )
      if (rows.length === 0) return [] as Group[]
      const groups = must(
        await supabase
          .from('groups')
          .select('*')
          .in(
            'id',
            rows.map((r) => r.group_id),
          ),
      ) as Group[]
      const order = rows.map((r) => r.group_id)
      return groups.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    },
  })
}

export function useMembers(gid: string) {
  return useQuery({
    queryKey: keys.members(gid),
    queryFn: async (): Promise<Member[]> => {
      const members = must(
        await supabase.from('group_members').select('*').eq('group_id', gid).order('joined_at'),
      ) as Omit<Member, 'display_name'>[]
      const profiles = must(
        await supabase
          .from('profiles')
          .select('id, display_name')
          .in(
            'id',
            members.map((m) => m.user_id),
          ),
      ) as { id: string; display_name: string }[]
      const names = new Map(profiles.map((p) => [p.id, p.display_name]))
      return members.map((m) => ({ ...m, display_name: names.get(m.user_id) ?? 'Alguém' }))
    },
  })
}

export function useCheckins(gid: string, from: string, to: string) {
  return useQuery({
    queryKey: keys.checkins(gid, from, to),
    queryFn: async () =>
      must(
        await supabase
          .from('checkins')
          .select('*')
          .eq('group_id', gid)
          .gte('day', from)
          .lte('day', to)
          .order('created_at', { ascending: false }),
      ) as Checkin[],
  })
}

export function useExceptions(gid: string, from: string, to: string) {
  return useQuery({
    queryKey: keys.exceptions(gid, from, to),
    queryFn: async () =>
      must(
        await supabase
          .from('exceptions')
          .select('*')
          .eq('group_id', gid)
          .gte('day', from)
          .lte('day', to)
          .order('day', { ascending: false }),
      ) as ExceptionDay[],
  })
}

export function useJokers(gid: string) {
  return useQuery({
    queryKey: keys.jokers(gid),
    queryFn: async () =>
      must(
        await supabase.from('jokers').select('*').eq('group_id', gid).order('week_start', { ascending: false }),
      ) as Joker[],
  })
}

export function useWeeks(gid: string) {
  return useQuery({
    queryKey: keys.weeks(gid),
    queryFn: async () =>
      must(
        await supabase.from('weeks').select('*').eq('group_id', gid).order('week_start', { ascending: false }),
      ) as Week[],
  })
}

export function useWeekResults(gid: string) {
  return useQuery({
    queryKey: keys.results(gid),
    queryFn: async () =>
      must(
        await supabase
          .from('week_results')
          .select('*')
          .eq('group_id', gid)
          .order('week_start', { ascending: false }),
      ) as WeekResult[],
  })
}

export function usePunishments(gid: string) {
  return useQuery({
    queryKey: keys.punishments(gid),
    queryFn: async () =>
      must(
        await supabase.from('punishments').select('*').eq('group_id', gid).order('created_at'),
      ) as Punishment[],
  })
}

export function useGyms(gid: string) {
  return useQuery({
    queryKey: keys.gyms(gid),
    queryFn: async () =>
      must(await supabase.from('gyms').select('*').eq('group_id', gid).order('created_at')) as Gym[],
  })
}

/** URLs assinadas (válidas por 1 hora) para as fotos privadas. */
export function usePhotoUrls(paths: string[]) {
  const sorted = [...new Set(paths)].sort()
  return useQuery({
    queryKey: ['photos', sorted],
    enabled: sorted.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const data = must(await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(sorted, 60 * 60))
      const map = new Map<string, string>()
      for (const item of data) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl)
      return map
    },
  })
}

// ---------------------------------------------------------------------
// Escritas
// ---------------------------------------------------------------------

function useInvalidate() {
  const qc = useQueryClient()
  return (...prefixes: string[]) =>
    Promise.all(prefixes.map((p) => qc.invalidateQueries({ queryKey: [p] })))
}

export interface CheckinInput {
  photo: Blob
  /** Posição no momento da foto. O banco escolhe a academia e confere os 300 m. */
  position: { lat: number; lng: number; accuracy: number } | null
}

export function useCreateCheckin(gid: string, userId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ photo, position }: CheckinInput) => {
      const path = `${gid}/${userId}/${crypto.randomUUID()}.jpg`
      must(await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: 'image/jpeg' }))
      const res = await supabase.from('checkins').insert({
        group_id: gid,
        photo_path: path,
        ...(position ? { lat: position.lat, lng: position.lng, accuracy_m: position.accuracy } : {}),
      })
      if (res.error) {
        // Não deixa foto órfã no armazenamento se o check-in foi recusado.
        await supabase.storage.from(PHOTO_BUCKET).remove([path])
        throw res.error
      }
    },
    onSuccess: () => invalidate('checkins'),
  })
}

export function useDeleteCheckin() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (c: Checkin) => {
      must(await supabase.from('checkins').delete().eq('id', c.id))
      await supabase.storage.from(PHOTO_BUCKET).remove([c.photo_path])
    },
    onSuccess: () => invalidate('checkins'),
  })
}

export function useAddException(gid: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { day: string; reason: ExceptionReason; note?: string }) =>
      must(
        await supabase
          .from('exceptions')
          .insert({ group_id: gid, day: input.day, reason: input.reason, note: input.note || null }),
      ),
    onSuccess: () => invalidate('exceptions'),
  })
}

export function useRemoveException() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('exceptions').delete().eq('id', id)),
    onSuccess: () => invalidate('exceptions'),
  })
}

export function useUseJoker(gid: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (weekStart: string) =>
      must(await supabase.from('jokers').insert({ group_id: gid, week_start: weekStart })),
    onSuccess: () => invalidate('jokers'),
  })
}

export function useRemoveJoker() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('jokers').delete().eq('id', id)),
    onSuccess: () => invalidate('jokers'),
  })
}

export function useSetDebtStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { weekId: string; userId: string; paid?: boolean; taskDone?: boolean }) =>
      must(
        await supabase.rpc('set_debt_status', {
          p_week_id: input.weekId,
          p_user_id: input.userId,
          p_paid: input.paid ?? null,
          p_task_done: input.taskDone ?? null,
        }),
      ),
    onSuccess: () => invalidate('results'),
  })
}

export function useSavePunishment(gid: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (p: { id?: string; kind: string; description: string; active?: boolean }) => {
      if (p.id) {
        const patch: Partial<Punishment> = { kind: p.kind, description: p.description }
        if (p.active !== undefined) patch.active = p.active
        return must(await supabase.from('punishments').update(patch).eq('id', p.id))
      }
      return must(
        await supabase.from('punishments').insert({ group_id: gid, kind: p.kind, description: p.description }),
      )
    },
    onSuccess: () => invalidate('punishments'),
  })
}

export function useDeletePunishment() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('punishments').delete().eq('id', id)),
    onSuccess: () => invalidate('punishments'),
  })
}

export function useAddGym(gid: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (g: { name: string; address?: string; place_id?: string; lat: number; lng: number }) =>
      must(
        await supabase.from('gyms').insert({
          group_id: gid,
          name: g.name.trim().slice(0, 80),
          address: g.address?.slice(0, 200) || null,
          place_id: g.place_id || null,
          lat: g.lat,
          lng: g.lng,
        }),
      ),
    onSuccess: () => invalidate('gyms'),
  })
}

export function useRemoveGym() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('gyms').delete().eq('id', id)),
    onSuccess: () => invalidate('gyms'),
  })
}

export function useUpdateGroupRules(gid: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (patch: Partial<GroupRulesUpdate>) =>
      must(await supabase.from('groups').update(patch).eq('id', gid)),
    onSuccess: () => invalidate('my-groups'),
  })
}

export function useUpdateMyName(userId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (name: string) =>
      must(await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId)),
    onSuccess: () => invalidate('members'),
  })
}

export function useCreateGroup() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (name: string) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
      return must(await supabase.rpc('create_group', { p_name: name, p_timezone: timezone })) as string
    },
    onSuccess: () => invalidate('my-groups'),
  })
}

export function useJoinGroup() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (code: string) => must(await supabase.rpc('join_group', { p_code: code })) as string,
    onSuccess: () => invalidate('my-groups'),
  })
}

export function useLeaveGroup() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (gid: string) => must(await supabase.rpc('leave_group', { gid })),
    onSuccess: () => invalidate('my-groups'),
  })
}

/** Fecha semanas vencidas caso o agendamento do banco esteja atrasado. */
export async function catchUpWeeks(gid: string): Promise<number> {
  const { data, error } = await supabase.rpc('catch_up_weeks', { gid })
  if (error) throw error
  return (data as number) ?? 0
}
