/**
 * Exportar meus dados (LGPD): monta um arquivo JSON com tudo o que é da pessoa no app.
 * As fotos não vão dentro do arquivo (ficariam enormes); vai o nome de cada uma.
 */
import type { MyDataRaw } from '@/data/queries'

const pick = (row: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]))

export function buildDataExport(raw: MyDataRaw, generatedAt: string) {
  return {
    app: 'Treino a Dois',
    gerado_em: generatedAt,
    aviso:
      'Estes são os seus dados no Treino a Dois. As fotos não estão dentro deste arquivo: aparece só o nome de cada uma. ' +
      'Para pedir a exclusão da conta, fale com quem administra o app.',
    conta: { id: raw.profile?.id ?? null, nome: raw.profile?.display_name ?? null, email: raw.email },
    grupos: raw.groups.map((g) => {
      const m = raw.memberships.find((x) => x.group_id === g.id) ?? {}
      return { ...pick(g, ['id', 'name', 'weekly_goal', 'fine_min', 'fine_max', 'timezone']), papel: m.role ?? null, entrou_em: m.joined_at ?? null }
    }),
    treinos: raw.checkins.map((c) => pick(c, ['id', 'group_id', 'day', 'created_at', 'kind', 'gym_name', 'distance_m', 'lat', 'lng', 'photo_path'])),
    excecoes: raw.exceptions.map((e) => pick(e, ['id', 'group_id', 'day', 'reason', 'note', 'created_at', 'reviewed_at'])),
    coringas: raw.jokers.map((j) => pick(j, ['id', 'group_id', 'week_start', 'created_at'])),
    semanas: raw.weekResults.map((r) =>
      pick(r, ['group_id', 'week_start', 'goal', 'checkins', 'met', 'used_joker', 'owes', 'fine_amount', 'punishment_text', 'paid_at', 'paid_claimed_at', 'task_done_at']),
    ),
    planos: raw.plans.map((p) => pick(p, ['group_id', 'day', 'period', 'created_at'])),
    chamadas_vamos: raw.nudges.map((n) => pick(n, ['group_id', 'from_user', 'to_user', 'created_at', 'seen_at'])),
    fotos_de_evolucao: raw.evolutionPhotos.map((p) => pick(p, ['taken_on', 'weight_kg', 'note', 'shared', 'photo_path', 'created_at'])),
    retiradas_da_caixinha: raw.withdrawals.map((w) => pick(w, ['group_id', 'amount', 'description', 'created_at'])),
  }
}
