/**
 * Leitura de links compartilhados do Google Maps (e do Apple Maps).
 * Funciona sem chave do Google: a pessoa acha a academia no app de mapas,
 * toca em Compartilhar > Copiar link e cola aqui. Links curtos (maps.app.goo.gl)
 * são abertos por /api/maps-link, que só segue os redirecionamentos.
 */

export interface SharedPlace {
  name: string
  address: string
  lat: number
  lng: number
}

/** Endereço do Google Maps já com a busca pelo nome. */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim() || 'academia')}`
}

const SHORT_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'maps.apple']

const MAPS_HOSTS = [
  ...SHORT_HOSTS,
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.com.br',
  'www.google.com.br',
  'maps.google.com.br',
  'maps.apple.com',
]

/** Primeiro link http(s) dentro de um texto colado. */
export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i)
  return m ? m[0].replace(/[).,;]+$/, '') : null
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isMapsUrl(url: string): boolean {
  const host = hostOf(url)
  return host !== null && MAPS_HOSTS.includes(host)
}

/** Link curto que precisa ser aberto para revelar o endereço completo. */
export function isShortMapsUrl(url: string): boolean {
  const host = hostOf(url)
  return host !== null && SHORT_HOSTS.includes(host)
}

const NUM = String.raw`-?\d{1,3}(?:\.\d+)?`
const PIN = new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`, 'g')
const PAIR = new RegExp(String.raw`^\s*(${NUM})\s*,\s*(${NUM})\s*$`)
const COORD_PARAMS = ['ll', 'q', 'query', 'coordinate', 'center', 'daddr', 'destination', 'sll']

function valid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' ')).trim()
  } catch {
    return s.replace(/\+/g, ' ').trim()
  }
}

/**
 * Posição e nome a partir de um endereço completo do Google ou Apple Maps.
 * Usa o pino do lugar (`!3d…!4d…`) ou uma coordenada explícita (`q=lat,lng`, `ll=`).
 * Ignora de propósito o `@lat,lng`: é o centro da tela, que pode estar a centenas
 * de metros da academia, e o raio é só de 100 m.
 */
export function parseMapsUrl(url: string): Partial<SharedPlace> {
  const out: Partial<SharedPlace> = {}
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return out
  }

  const pins = [...url.matchAll(PIN)]
  const pin = pins.at(-1)
  if (pin && valid(Number(pin[1]), Number(pin[2]))) {
    out.lat = Number(pin[1])
    out.lng = Number(pin[2])
  }

  for (const key of COORD_PARAMS) {
    const v = u.searchParams.get(key)
    if (!v) continue
    const m = v.match(PAIR)
    if (m && out.lat === undefined && valid(Number(m[1]), Number(m[2]))) {
      out.lat = Number(m[1])
      out.lng = Number(m[2])
    } else if (!m && (key === 'q' || key === 'query') && !out.name) {
      out.name = decode(v).split(',')[0].trim()
    }
  }

  const place = u.pathname.match(/\/maps\/place\/([^/@]+)/)
  if (place) out.name = decode(place[1])
  const appleName = u.searchParams.get('name')
  if (appleName && !out.name) out.name = appleName.trim()
  const appleAddress = u.searchParams.get('address')
  if (appleAddress) out.address = appleAddress.trim()

  return out
}

/**
 * Texto copiado do botão Compartilhar: às vezes vem só o link, às vezes
 * "Nome\nEndereço\nlink". As linhas sem link viram nome e endereço.
 */
export function parseSharedText(text: string): { name?: string; address?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/https?:\/\/\S+/gi, '').trim())
    .filter((l) => l.length > 1)
  return { name: lines[0], address: lines[1] }
}

/** Junta tudo; devolve null se o link não trouxer uma posição confiável. */
export function placeFromShare(text: string, resolvedUrl: string): SharedPlace | null {
  const fromUrl = parseMapsUrl(resolvedUrl)
  if (fromUrl.lat === undefined || fromUrl.lng === undefined) return null
  const fromText = parseSharedText(text)
  return {
    name: (fromText.name || fromUrl.name || '').slice(0, 80),
    address: (fromText.address || fromUrl.address || '').slice(0, 200),
    lat: fromUrl.lat,
    lng: fromUrl.lng,
  }
}
