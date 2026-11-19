/**
 * GET /api/maps-link?url=<link curto do Google/Apple Maps>
 * Segue os redirecionamentos e devolve { url } com o endereço final.
 * Só abre endereços de mapas (lista abaixo) para não virar um "abridor de links" genérico.
 * Não baixa a página: só lê o cabeçalho Location de cada salto.
 */

import { embedUrl, parseEmbed, type EmbedPlace } from './_embed.js'

const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'g.co',
  'maps.apple',
  'maps.apple.com',
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.com.br',
  'www.google.com.br',
  'maps.google.com.br',
])

const MAX_HOPS = 5
const TIMEOUT_MS = 6000
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

function allowed(u: URL): boolean {
  return (u.protocol === 'https:' || u.protocol === 'http:') && ALLOWED_HOSTS.has(u.hostname.toLowerCase())
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get('url') ?? ''
  let current: URL
  try {
    current = new URL(raw)
  } catch {
    return json({ error: 'Link inválido' }, 400)
  }
  if (raw.length > 2000 || !allowed(current)) return json({ error: 'Esse link não é do Google Maps' }, 400)

  const deadline = AbortSignal.timeout(TIMEOUT_MS)
  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const res = await fetch(current, { redirect: 'manual', signal: deadline, headers: { 'user-agent': UA } })
      await res.body?.cancel()
      const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
      if (!location) break
      const next = new URL(location, current)
      // Página de consentimento de cookies: o destino real vem no parâmetro "continue".
      if (next.hostname === 'consent.google.com') {
        const cont = next.searchParams.get('continue')
        if (cont) current = new URL(cont)
        break
      }
      if (!allowed(next)) return json({ error: 'O link levou para fora do Google Maps' }, 400)
      current = next
    }
  } catch {
    return json({ error: 'Não consegui abrir o link agora. Tente de novo.' }, 502)
  }
  const finalUrl = current.toString()

  // Link sem pino (?q=nome&ftid=id): pega a posição exata do lugar no endereço "embed".
  let place: EmbedPlace | null = null
  const ftid = current.searchParams.get('ftid')
  const q = current.searchParams.get('q')
  if (ftid && q && !/!3d-?\d/.test(finalUrl)) {
    try {
      const res = await fetch(embedUrl(q, ftid), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9' },
      })
      if (res.ok) place = parseEmbed((await res.text()).slice(0, 400_000), ftid)
    } catch {
      // sem a posição, o app explica o que fazer
    }
  }
  return json({ url: finalUrl, ...(place ? { place } : {}) })
}
