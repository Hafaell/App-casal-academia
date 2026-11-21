/**
 * Supabase de mentira, em memória, para os testes das telas. Imita só o que o app usa:
 * tabelas com filtros simples, as funções (rpc) e os gatilhos que o banco real aplica
 * (quem é o dono da linha, o dia do check-in e a conferência da academia).
 * As regras de dinheiro de verdade são testadas no banco (supabase/tests).
 */
import { localDate, localToday } from '@domain/dates'
import { rewardMilestones } from '@domain/rewards'
import { challengeProgress } from '@domain/challenges'
import { GYM_RADIUS_M, distanceMeters } from '@domain/geo'

type Row = Record<string, any>
type Filter = (r: Row) => boolean

export interface FakeDb {
  [table: string]: Row[]
}

let seq = 0
const uid = (p: string) => `${p}-${++seq}`

export function createFakeSupabase() {
  const db: FakeDb = {}
  const users = new Map<string, { id: string; email: string; password: string; name: string }>()
  let session: any = null
  const listeners = new Set<(event: string, session: any) => void>()
  const uploads: string[] = []
  const removed: string[] = []
  const rpcCalls: { name: string; args: any }[] = []
  const recoveryCodes = new Map<string, string>()
  /** Tabelas que "ainda não existem" no banco (migração não aplicada). */
  const missingTables = new Set<string>()

  const table = (name: string): any[] => (db[name] ??= [])
  const me = () => session?.user.id as string | undefined
  const now = () => new Date().toISOString()
  const fail = (message: string) => ({ data: null, error: { message } })

  function emit(event: string) {
    for (const l of listeners) l(event, session)
  }

  function groupOf(id: string): any {
    return table('groups').find((g) => g.id === id)
  }

  /** Gatilhos do banco real, na ordem em que o app depende deles. */
  function beforeInsert(name: string, row: Row): Row | { error: string } {
    const user = me()
    if (!user) return { error: 'sem login' }
    switch (name) {
      case 'checkins': {
        const g = groupOf(row.group_id)
        const day = localToday(g.timezone)
        if (table('checkins').some((c) => c.user_id === user && c.day === day && c.group_id === row.group_id))
          return { error: 'Você já registrou o treino de hoje' }
        let gym: Row | undefined
        let distance: number | null = null
        if (row.lat != null) {
          const mine = table('gyms').filter((x) => x.group_id === row.group_id && x.created_by === user)
          for (const x of mine) {
            const d = distanceMeters({ lat: row.lat, lng: row.lng }, x)
            if (distance === null || d < distance) {
              distance = Math.round(d)
              gym = x
            }
          }
        }
        if (g.require_location && (distance === null || distance > GYM_RADIUS_M)) return { error: 'Você precisa estar na academia' }
        return {
          id: uid('checkin'),
          kind: null,
          lat: null,
          lng: null,
          accuracy_m: null,
          ...row,
          user_id: user,
          day,
          created_at: now(),
          gym_id: gym?.id ?? null,
          gym_name: gym?.name ?? null,
          distance_m: distance,
        }
      }
      case 'exceptions':
        if (table('exception_rejections').some((r) => r.group_id === row.group_id && r.author_id === user && r.day === row.day))
          return { error: 'O seu parceiro recusou a exceção desse dia. Não dá para marcar de novo' }
        {
          const lim = groupOf(row.group_id).exceptions_per_month ?? 999
          const used = table('exceptions').filter((x) => x.group_id === row.group_id && x.user_id === user && x.day.slice(0, 7) === row.day.slice(0, 7)).length
          if (used >= lim) return { error: `Você já usou as ${lim} exceções deste mês` }
        }
        return { id: uid(name), note: null, ...row, user_id: user, created_at: now(), reviewed_by: null, reviewed_at: null }
      case 'jokers':
        return { id: uid(name), note: null, ...row, user_id: user, created_at: now() }
      case 'workout_plans':
        if (table('workout_plans').some((p) => p.group_id === row.group_id && p.user_id === user && p.day === row.day))
          return { error: 'duplicate key value violates unique constraint "one_plan_per_day"' }
        return { id: uid('plan'), period: null, ...row, user_id: user, created_at: now() }
      case 'nudges':
        if (table('nudges').some((n) => n.from_user === user && n.to_user === row.to_user && Date.parse(n.created_at) > Date.now() - 30 * 60_000))
          return { error: 'Você já chamou há pouco. Espere meia hora para chamar de novo' }
        return { id: uid('nudge'), ...row, from_user: user, created_at: now(), seen_at: null }
      case 'monthly_challenges':
        if (table('monthly_challenges').some((c) => c.group_id === row.group_id && c.month === row.month))
          return { error: 'duplicate key value violates unique constraint "one_challenge_per_month"' }
        return { id: uid('challenge'), ...row, created_by: user, created_at: now() }
      case 'evolution_photos':
        return { id: uid('evo'), weight_kg: null, note: null, shared: false, ...row, user_id: user, created_at: now() }
      case 'rewards':
        return { id: uid('reward'), active: true, ...row, created_at: now() }
      case 'gyms':
        return { id: uid('gym'), ...row, created_by: user, created_at: now() }
      case 'kitty_withdrawals':
        return { id: uid('withdrawal'), ...row, withdrawn_by: user, created_at: now() }
      case 'kitty_goals':
        if (table('kitty_goals').some((g) => g.group_id === row.group_id && !g.completed_at))
          return { error: 'duplicate key value violates unique constraint "kitty_goals_one_open"' }
        return { id: uid('goal'), ...row, created_by: user, created_at: now(), completed_at: null, withdrawal_id: null }
      case 'punishments':
        return { id: uid('punishment'), active: true, ...row, created_at: now() }
      case 'reactions':
        return { id: uid('reaction'), ...row, group_id: table('checkins').find((c) => c.id === row.checkin_id)?.group_id, created_at: now() }
      default:
        return { id: uid(name), ...row }
    }
  }

  function builder(name: string) {
    const filters: Filter[] = []
    let orderBy: { col: string; asc: boolean } | null = null
    let op: { kind: 'select' } | { kind: 'insert'; rows: Row[] } | { kind: 'update'; patch: Row } | { kind: 'delete' } = { kind: 'select' }

    function run() {
      if (missingTables.has(name)) return fail(`Could not find the table 'public.${name}' in the schema cache`)
      const rows = table(name)
      switch (op.kind) {
        case 'select': {
          let out = rows.filter((r) => filters.every((f) => f(r))).map((r) => ({ ...r }))
          if (orderBy) {
            const { col, asc } = orderBy
            out = out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1))
          }
          return { data: out, error: null }
        }
        case 'insert': {
          for (const r of op.rows) {
            const row = beforeInsert(name, r)
            if ('error' in row && typeof row.error === 'string') return fail(row.error)
            rows.push(row as Row)
          }
          return { data: null, error: null }
        }
        case 'update': {
          for (const r of rows) if (filters.every((f) => f(r))) Object.assign(r, op.patch)
          return { data: null, error: null }
        }
        case 'delete': {
          db[name] = rows.filter((r) => !filters.every((f) => f(r)))
          return { data: null, error: null }
        }
      }
    }

    const q: any = {
      select: () => q,
      insert: (rows: Row | Row[]) => ((op = { kind: 'insert', rows: Array.isArray(rows) ? rows : [rows] }), q),
      update: (patch: Row) => ((op = { kind: 'update', patch }), q),
      delete: () => ((op = { kind: 'delete' }), q),
      eq: (col: string, v: any) => (filters.push((r) => r[col] === v), q),
      in: (col: string, vs: any[]) => (filters.push((r) => vs.includes(r[col])), q),
      gte: (col: string, v: any) => (filters.push((r) => r[col] >= v), q),
      lte: (col: string, v: any) => (filters.push((r) => r[col] <= v), q),
      order: (col: string, o?: { ascending?: boolean }) => ((orderBy = { col, asc: o?.ascending !== false }), q),
      then: (resolve: (v: any) => void, reject: (e: unknown) => void) => Promise.resolve().then(run).then(resolve, reject),
    }
    return q
  }

  function addMember(groupId: string, userId: string, role: 'owner' | 'member') {
    const g = groupOf(groupId)
    table('group_members').push({ group_id: groupId, user_id: userId, role, starts_on: g.starts_on, joined_at: now() })
  }

  const rpcs: Record<string, (args: any) => any> = {
    create_group: ({ p_name, p_timezone }) => {
      const id = uid('group')
      table('groups').push({
        id,
        name: p_name,
        invite_code: 'ABC123',
        weekly_goal: 4,
        fine_min: 10,
        fine_max: 50,
        sunday_counts: false,
        jokers_per_month: 1,
        timezone: p_timezone,
        starts_on: localToday(p_timezone),
        require_location: true,
      })
      addMember(id, me()!, 'owner')
      return id
    },
    join_group: ({ p_code }) => {
      const g = table('groups').find((x) => x.invite_code === p_code)
      if (!g) throw new Error('Código de convite inválido')
      addMember(g.id, me()!, 'member')
      return g.id
    },
    leave_group: ({ gid }) => {
      db.group_members = table('group_members').filter((m) => !(m.group_id === gid && m.user_id === me()))
      return null
    },
    catch_up_weeks: () => 0,
    set_debt_status: ({ p_week_id, p_user_id, p_paid, p_task_done }) => {
      const r = table('week_results').find((x) => x.week_id === p_week_id && x.user_id === p_user_id)
      if (p_paid !== null) {
        // Mesma regra do banco: quem deve só avisa; outra pessoa confirma.
        if (p_user_id === me()) {
          if (r.paid_at) throw new Error('O pagamento já foi confirmado. Só quem recebeu pode desfazer')
          r.paid_claimed_at = p_paid ? (r.paid_claimed_at ?? now()) : null
        } else {
          Object.assign(r, {
            paid_at: p_paid ? (r.paid_at ?? now()) : null,
            paid_marked_by: p_paid ? me() : null,
            paid_claimed_at: p_paid ? (r.paid_claimed_at ?? now()) : null,
          })
        }
      }
      if (p_task_done !== null) r.task_done_at = p_task_done ? now() : null
      return null
    },
    review_exception: ({ p_exception, p_approve, p_why }) => {
      const e = table('exceptions').find((x) => x.id === p_exception)
      if (!e) throw new Error('Exceção não encontrada')
      if (e.user_id === me()) throw new Error('A exceção é sua: quem responde é o seu parceiro')
      if (e.reviewed_at) throw new Error('Essa exceção já foi aprovada')
      const tz = groupOf(e.group_id).timezone
      if (localToday(tz) > localDate(e.created_at, tz))
        throw new Error('O prazo para responder acabou às 23h59 do dia em que a exceção foi marcada. Ela já vale')
      if (p_approve) {
        Object.assign(e, { reviewed_by: me(), reviewed_at: now() })
        return null
      }
      table('exception_rejections').push({
        id: uid('rejection'),
        group_id: e.group_id,
        exception_id: e.id,
        author_id: e.user_id,
        rejected_by: me(),
        day: e.day,
        reason: e.reason,
        note: e.note,
        why: p_why ? String(p_why).trim() || null : null,
        created_at: now(),
      })
      db.exceptions = table('exceptions').filter((x) => x.id !== e.id)
      return null
    },
    spin_reward: ({ gid, p_week_start }) => {
      const outcomes = table('week_results')
        .filter((r) => r.group_id === gid)
        .map((r) => ({ weekStart: r.week_start, userId: r.user_id, met: r.met, usedJoker: r.used_joker }))
      if (!rewardMilestones(outcomes).includes(p_week_start)) throw new Error('Essa semana não completou 2 semanas seguidas de meta batida')
      if (table('reward_spins').some((s) => s.group_id === gid && s.week_start === p_week_start)) throw new Error('A roleta deste prêmio já foi girada')
      const r = table('rewards').find((x) => x.group_id === gid && x.active)
      if (!r) throw new Error('Cadastre pelo menos um prêmio ativo antes de girar')
      const spin = { id: uid('spin'), group_id: gid, week_start: p_week_start, reward_id: r.id, reward_text: r.description, spun_by: me(), created_at: now(), redeemed_at: null }
      table('reward_spins').push(spin)
      return { ...spin }
    },
    spin_challenge_reward: ({ p_challenge }) => {
      const ch = table('monthly_challenges').find((x) => x.id === p_challenge)
      if (!ch) throw new Error('Desafio não encontrado')
      if (!challengeProgress(ch, table('checkins').filter((c) => c.group_id === ch.group_id)).complete) throw new Error('O desafio ainda não foi cumprido')
      if (table('reward_spins').some((s) => s.challenge_id === ch.id)) throw new Error('O giro deste desafio já foi usado')
      const r = table('rewards').find((x) => x.group_id === ch.group_id && x.active)
      if (!r) throw new Error('Cadastre pelo menos um prêmio ativo antes de girar')
      const spin = { id: uid('spin'), group_id: ch.group_id, week_start: null, challenge_id: ch.id, reward_id: r.id, reward_text: r.description, spun_by: me(), created_at: now(), redeemed_at: null }
      table('reward_spins').push(spin)
      return { ...spin }
    },
    complete_kitty_goal: ({ p_goal }) => {
      const g = table('kitty_goals').find((x) => x.id === p_goal)
      if (!g) throw new Error('Objetivo não encontrado')
      const paid = table('week_results')
        .filter((r) => r.group_id === g.group_id && r.owes && r.paid_at)
        .reduce((s, r) => s + r.fine_amount, 0)
      const out = table('kitty_withdrawals')
        .filter((w) => w.group_id === g.group_id)
        .reduce((s, w) => s + w.amount, 0)
      if (paid - out < g.target_amount) throw new Error(`A caixinha tem R$ ${paid - out}, falta R$ ${g.target_amount - (paid - out)} para o objetivo`)
      const id = uid('withdrawal')
      table('kitty_withdrawals').push({ id, group_id: g.group_id, amount: g.target_amount, description: g.title, withdrawn_by: me(), created_at: now() })
      Object.assign(g, { completed_at: now(), withdrawal_id: id })
      return id
    },
    report_checkin: ({ p_checkin, p_reason }) => {
      const c = table('checkins').find((x) => x.id === p_checkin)
      table('checkin_reports').push({
        id: uid('report'),
        group_id: c.group_id,
        checkin_id: c.id,
        author_id: c.user_id,
        reporter_id: me(),
        day: c.day,
        reason: p_reason,
        photo_path: c.photo_path,
        gym_name: c.gym_name,
        distance_m: c.distance_m,
        created_at: now(),
      })
      db.checkins = table('checkins').filter((x) => x.id !== p_checkin)
      return null
    },
  }

  const client = {
    from: (name: string) => builder(name),
    rpc: async (name: string, args: any) => {
      rpcCalls.push({ name, args })
      try {
        return { data: rpcs[name](args), error: null }
      } catch (e) {
        return fail((e as Error).message)
      }
    },
    storage: {
      from: () => ({
        upload: async (path: string) => (uploads.push(path), { data: { path }, error: null }),
        remove: async (paths: string[]) => (removed.push(...paths), { data: null, error: null }),
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://fotos.test/${p}` })), error: null }),
      }),
    },
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: (cb: (event: string, s: any) => void) => {
        listeners.add(cb)
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const u = [...users.values()].find((x) => x.email === email)
        if (!u || u.password !== password) return { data: { session: null }, error: { message: 'Invalid login credentials' } }
        session = { user: { id: u.id, email } }
        emit('SIGNED_IN')
        return { data: { session }, error: null }
      },
      signUp: async ({ email, password, options }: any) => {
        if ([...users.values()].some((x) => x.email === email)) return { data: { session: null }, error: { message: 'User already registered' } }
        const id = uid('user')
        users.set(id, { id, email, password, name: options.data.display_name })
        table('profiles').push({ id, display_name: options.data.display_name })
        session = { user: { id, email } }
        emit('SIGNED_IN')
        return { data: { session }, error: null }
      },
      /** Recuperar senha: o "e-mail" guarda o código 123456 para quem tem conta. */
      resetPasswordForEmail: async (email: string) => {
        if ([...users.values()].some((x) => x.email === email)) recoveryCodes.set(email, '123456')
        return { data: {}, error: null }
      },
      verifyOtp: async ({ email, token }: { email: string; token: string; type: string }) => {
        if (recoveryCodes.get(email) !== token) return { data: { session: null }, error: { message: 'Token has expired or is invalid' } }
        recoveryCodes.delete(email)
        const u = [...users.values()].find((x) => x.email === email)!
        session = { user: { id: u.id, email } }
        emit('SIGNED_IN')
        return { data: { session }, error: null }
      },
      updateUser: async ({ password }: { password: string }) => {
        const u = users.get(session?.user.id)
        if (!u) return { data: null, error: { message: 'sem login' } }
        u.password = password
        return { data: { user: session.user }, error: null }
      },
      signOut: async () => {
        session = null
        emit('SIGNED_OUT')
        return { error: null }
      },
      startAutoRefresh: () => undefined,
      stopAutoRefresh: () => undefined,
    },
  }

  return {
    client,
    db,
    uploads,
    removed,
    rpcCalls,
    missingTables,
    /** Cria uma conta e já deixa logado (como se a sessão estivesse salva no aparelho). */
    login(id: string, name: string) {
      users.set(id, { id, email: `${id}@teste.com`, password: 'segredo', name })
      if (!table('profiles').some((p) => p.id === id)) table('profiles').push({ id, display_name: name })
      session = { user: { id, email: `${id}@teste.com` } }
    },
    addUser(id: string, name: string, email: string, password: string) {
      users.set(id, { id, email, password, name })
      table('profiles').push({ id, display_name: name })
    },
  }
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>
