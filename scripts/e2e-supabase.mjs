// Teste de ponta a ponta contra o projeto Supabase real (.env.local).
// Usa as mesmas chamadas de src/data/queries.ts.
//
//   node scripts/e2e-supabase.mjs
//
// Cria 3 contas de teste (e2e-*@...) e um grupo "E2E ...". No fim apaga fotos,
// check-ins, exceções e coringas e sai dos grupos. As contas e os grupos vazios
// ficam para serem removidos pelo SQL Editor (o script imprime o comando).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!URL_ || !KEY) throw new Error('Preencha .env.local')

const run = Date.now().toString(36)
const domain = process.env.E2E_EMAIL_DOMAIN ?? 'treinoadois-e2e.com'
let failures = 0

function ok(name, cond, detail = '') {
  if (cond) console.log(`  ok    ${name}`)
  else {
    failures++
    console.log(`  FALHA ${name} ${detail}`)
  }
}
const msg = (e) => (e ? `${e.code ?? ''} ${e.message ?? e}`.trim() : '')

function client() {
  return createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function signUp(label) {
  const c = client()
  const email = `e2e-${label}-${run}@${domain}`
  const password = randomBytes(18).toString('base64url')
  const { data, error } = await c.auth.signUp({
    email,
    password,
    options: { data: { display_name: `Teste ${label.toUpperCase()}` } },
  })
  if (error) throw new Error(`signUp ${label}: ${msg(error)}`)
  ok(`cadastro ${label} já devolve sessão (sem confirmação de e-mail)`, Boolean(data.session))
  if (!data.session) {
    const r = await c.auth.signInWithPassword({ email, password })
    if (r.error) throw new Error(`login ${label}: ${msg(r.error)}`)
  }
  // Login em um cliente novo, como o app faz depois de reabrir.
  const c2 = client()
  const login = await c2.auth.signInWithPassword({ email, password })
  ok(`login ${label} com e-mail e senha`, !login.error && Boolean(login.data.session), msg(login.error))
  return { c: c2, id: login.data.user.id, email }
}

// JPEG mínimo válido (1x1).
const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  'base64',
)

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const dow = new Date(`${today}T12:00:00Z`).getUTCDay() // 0 = domingo
const addDays = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
const monday = addDays(today, dow === 0 ? -6 : 1 - dow)
console.log(`Projeto: ${URL_}\nHoje (Brasília): ${today}, dia da semana ${dow}; segunda da semana: ${monday}\n`)

const a = await signUp('a')
const b = await signUp('b')
const x = await signUp('x') // intruso, fora do grupo

console.log('\nPerfil e grupo')
{
  const { data, error } = await a.c.from('profiles').select('id, display_name').eq('id', a.id)
  ok('perfil criado pelo gatilho com o nome do cadastro', !error && data?.[0]?.display_name === 'Teste A', msg(error) || JSON.stringify(data))
}
const created = await a.c.rpc('create_group', { p_name: `E2E ${run}`, p_timezone: 'America/Sao_Paulo' })
ok('create_group', !created.error && typeof created.data === 'string', msg(created.error))
const gid = created.data
const g1 = await a.c.from('groups').select('*').eq('id', gid).single()
ok('dono lê o grupo', !g1.error && g1.data?.id === gid, msg(g1.error))
const group = g1.data ?? {}
console.log(`  grupo: meta=${group.weekly_goal} multa=${group.fine_min}-${group.fine_max} domingo=${group.sunday_counts} coringas=${group.jokers_per_month} inicio=${group.starts_on ?? group.first_week ?? '?'}`)
const codeField = Object.keys(group).find((k) => k.includes('code'))
const code = group[codeField]
ok('grupo tem código de convite', Boolean(code), JSON.stringify(Object.keys(group)))

{
  const p = await a.c.from('punishments').select('*').eq('group_id', gid)
  ok('roleta já vem com punições padrão', !p.error && p.data.length > 0, msg(p.error))
  console.log(`  punições padrão: ${p.data?.length}`)
}

console.log('\nIsolamento antes do convite')
{
  const r = await b.c.from('groups').select('id').eq('id', gid)
  ok('quem não é membro não vê o grupo', !r.error && r.data.length === 0, JSON.stringify(r.data))
  const bad = await b.c.rpc('join_group', { p_code: 'ZZZZZZZZ' })
  ok('código de convite errado é recusado', Boolean(bad.error))
}

console.log('\nConvite')
{
  const j = await b.c.rpc('join_group', { p_code: code })
  ok('join_group com o código', !j.error && j.data === gid, msg(j.error))
  const m = await b.c.from('group_members').select('user_id, role').eq('group_id', gid)
  ok('os dois aparecem como membros', !m.error && m.data.length === 2, msg(m.error) || JSON.stringify(m.data))
  const names = await b.c.from('profiles').select('id, display_name').in('id', [a.id, b.id])
  ok('membro vê o nome do parceiro', !names.error && names.data.length === 2, msg(names.error))
}

console.log('\nFoto e check-in')
async function checkin(u, label) {
  const path = `${gid}/${u.id}/${randomUUID()}.jpg`
  const up = await u.c.storage.from('checkins').upload(path, jpeg, { contentType: 'image/jpeg' })
  ok(`${label}: envio da foto para a própria pasta`, !up.error, msg(up.error))
  const ins = await u.c.from('checkins').insert({ group_id: gid, photo_path: path })
  return { path, ins }
}
let aPath = null
if (dow === 0 && !group.sunday_counts) {
  const r = await checkin(a, 'A')
  ok('domingo: check-in bloqueado pelo banco', Boolean(r.ins.error), 'o insert passou')
  console.log(`  mensagem: ${msg(r.ins.error)}`)
  await a.c.storage.from('checkins').remove([r.path])
  const upd = await a.c.from('groups').update({ sunday_counts: true }).eq('id', gid)
  ok('regra "domingo conta" pode ser ligada', !upd.error, msg(upd.error))
}
{
  const r = await checkin(a, 'A')
  ok('check-in de A registrado', !r.ins.error, msg(r.ins.error))
  aPath = r.path
  const dup = await checkin(a, 'A (2º do dia)')
  ok('segundo check-in no mesmo dia é recusado', Boolean(dup.ins.error), 'o insert passou')
  await a.c.storage.from('checkins').remove([dup.path])

  const list = await b.c.from('checkins').select('*').eq('group_id', gid)
  ok('parceiro vê o check-in no feed', !list.error && list.data.length === 1, msg(list.error))
  const row = list.data?.[0] ?? {}
  ok('dia do check-in vem do servidor no fuso do grupo', row.day === today, `day=${row.day}`)
  ok('user_id vem do servidor', row.user_id === a.id, `user_id=${row.user_id}`)

  const signed = await b.c.storage.from('checkins').createSignedUrls([aPath], 3600)
  const urlOk = !signed.error && Boolean(signed.data?.[0]?.signedUrl)
  ok('parceiro gera URL assinada da foto', urlOk, msg(signed.error) || JSON.stringify(signed.data))
  if (urlOk) {
    const res = await fetch(signed.data[0].signedUrl)
    const bytes = Buffer.from(await res.arrayBuffer())
    ok('foto baixada é igual à enviada', res.ok && bytes.equals(jpeg), `status ${res.status}, ${bytes.length} bytes`)
  }

  const xs = await x.c.storage.from('checkins').createSignedUrls([aPath], 3600)
  ok('intruso não consegue URL da foto', Boolean(xs.error) || !xs.data?.[0]?.signedUrl, JSON.stringify(xs.data))
  const xl = await x.c.from('checkins').select('id').eq('group_id', gid)
  ok('intruso não vê check-ins', !xl.error && xl.data.length === 0, JSON.stringify(xl.data))
  const xu = await x.c.storage.from('checkins').upload(`${gid}/${x.id}/${randomUUID()}.jpg`, jpeg, { contentType: 'image/jpeg' })
  ok('intruso não envia foto para o grupo', Boolean(xu.error), 'upload passou')
  const bu = await b.c.storage.from('checkins').upload(`${gid}/${a.id}/${randomUUID()}.jpg`, jpeg, { contentType: 'image/jpeg' })
  ok('membro não envia foto na pasta do outro', Boolean(bu.error), 'upload passou')
  const forged = await b.c.from('checkins').insert({ group_id: gid, photo_path: aPath, user_id: a.id, day: addDays(today, -1) })
  if (!forged.error) {
    const rows = await b.c.from('checkins').select('user_id, day').eq('group_id', gid).eq('user_id', b.id)
    ok('check-in forjado (outro usuário/dia) é normalizado pelo servidor', rows.data?.[0]?.day === today, JSON.stringify(rows.data))
  } else ok('check-in forjado (outro usuário/dia) é recusado', true)
}

console.log('\nExceção e coringa')
{
  // Próximo dia útil (seg a sex) a partir de amanhã.
  let d = addDays(today, 1)
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = addDays(d, 1)
  const ex = await b.c.from('exceptions').insert({ group_id: gid, day: d, reason: 'doenca', note: 'teste' }).select()
  if (ex.error) {
    const all = ['doenca', 'illness', 'sickness', 'travel', 'viagem']
    console.log(`  motivo "sick" recusado: ${msg(ex.error)}; tentando ${all.join(', ')}`)
  }
  ok(`exceção em ${d}`, !ex.error, msg(ex.error))
  const seen = await a.c.from('exceptions').select('*').eq('group_id', gid)
  ok('parceiro vê a exceção', !seen.error && seen.data.length === (ex.error ? 0 : 1), msg(seen.error))
  if (!ex.error) {
    const del = await b.c.from('exceptions').delete().eq('id', ex.data[0].id)
    ok('exceção pode ser desfeita', !del.error, msg(del.error))
  }

  const jk = await b.c.from('jokers').insert({ group_id: gid, week_start: monday }).select()
  ok('coringa na semana atual', !jk.error, msg(jk.error))
  const jk2 = await b.c.from('jokers').insert({ group_id: gid, week_start: monday })
  ok('segundo coringa no mesmo mês é recusado', Boolean(jk2.error), 'o insert passou')
  if (!jk.error) {
    const del = await b.c.from('jokers').delete().eq('id', jk.data[0].id)
    ok('coringa pode ser desfeito', !del.error, msg(del.error))
  }
}

console.log('\nRegras, roleta e fechamento')
{
  const upd = await b.c.from('groups').update({ fine_min: 15 }).eq('id', gid)
  ok('membro edita a faixa de multa', !upd.error, msg(upd.error))
  const hack = await b.c.from('groups').update({ [codeField]: 'HACKED00' }).eq('id', gid)
  const after = await a.c.from('groups').select('*').eq('id', gid).single()
  ok('membro não troca o código de convite direto na tabela', Boolean(hack.error) || after.data[codeField] === code, msg(hack.error))
  const p = await a.c.from('punishments').insert({ group_id: gid, kind: 'task', description: 'Teste E2E' }).select()
  ok('adicionar punição na roleta', !p.error, msg(p.error))
  if (!p.error) {
    const d = await a.c.from('punishments').delete().eq('id', p.data[0].id)
    ok('remover punição da roleta', !d.error, msg(d.error))
  }
  const cu = await a.c.rpc('catch_up_weeks', { gid })
  ok('catch_up_weeks roda (nada vencido ainda)', !cu.error && cu.data === 0, msg(cu.error) || `fechou ${cu.data}`)
  const cw = await a.c.rpc('close_week', { gid, wstart: monday })
  ok('close_week não é exposta para o app', Boolean(cw.error), 'a chamada passou')
  const wk = await a.c.from('weeks').insert({ group_id: gid, week_start: monday })
  ok('app não cria semana fechada na mão', Boolean(wk.error), 'o insert passou')
}

console.log('\nSem login')
{
  const anon = client()
  const r = await anon.from('groups').select('id')
  ok('visitante sem login não lê grupos', Boolean(r.error) || r.data.length === 0, JSON.stringify(r.data))
  const j = await anon.rpc('join_group', { p_code: code })
  ok('visitante sem login não entra em grupo', Boolean(j.error), 'a chamada passou')
}

console.log('\nLimpeza')
{
  const mine = await a.c.from('checkins').select('id, photo_path').eq('group_id', gid)
  for (const c of mine.data ?? []) {
    const owner = c.photo_path.split('/')[1] === a.id ? a : b
    const d = await owner.c.from('checkins').delete().eq('id', c.id)
    ok('apagar check-in da semana aberta', !d.error, msg(d.error))
  }
  const rm = await a.c.storage.from('checkins').remove([aPath])
  ok('apagar a própria foto', !rm.error && rm.data?.length === 1, msg(rm.error) || JSON.stringify(rm.data))
  const lb = await b.c.rpc('leave_group', { gid })
  ok('B sai do grupo', !lb.error, msg(lb.error))
  const la = await a.c.rpc('leave_group', { gid })
  ok('A sai do grupo', !la.error, msg(la.error))
}

console.log(`\n${failures === 0 ? 'TUDO CERTO' : `${failures} FALHA(S)`}`)
console.log(`\nPara remover as contas e o grupo de teste, rode no SQL Editor:
  delete from public.groups where name like 'E2E %';
  delete from auth.users where email like 'e2e-%@${domain}';`)
process.exit(failures === 0 ? 0 : 1)
