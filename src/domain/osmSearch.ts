/** Resultado da busca de lugares do OpenStreetMap (Nominatim) já no formato do app. */

export interface OsmPlace {
  name: string
  address: string
  lat: number
  lng: number
}

interface NominatimItem {
  lat?: string
  lon?: string
  name?: string
  display_name?: string
}

/** Converte a resposta do Nominatim; ignora itens sem posição válida. */
export function parseNominatim(items: unknown): OsmPlace[] {
  if (!Array.isArray(items)) return []
  const out: OsmPlace[] = []
  for (const it of items as NominatimItem[]) {
    const lat = Number(it.lat)
    const lng = Number(it.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    const full = (it.display_name ?? '').trim()
    const name = (it.name?.trim() || full.split(',')[0] || '').trim()
    if (!name) continue
    // "Nome, Rua, Bairro, Cidade, ..." -> o endereço é o que vem depois do nome.
    const address = full.startsWith(name) ? full.slice(name.length).replace(/^[\s,]+/, '') : full
    out.push({ name: name.slice(0, 80), address: address.slice(0, 200), lat, lng })
  }
  return out
}

/** Endereço da busca; com a posição, prioriza (sem limitar) resultados perto de você. */
export function nominatimUrl(query: string, near?: { lat: number; lng: number }): string {
  const p = new URLSearchParams({
    format: 'jsonv2',
    q: query.trim(),
    limit: '8',
    countrycodes: 'br',
    'accept-language': 'pt-BR',
  })
  if (near) {
    const d = 0.25 // ~28 km
    p.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`)
  }
  return `https://nominatim.openstreetmap.org/search?${p}`
}
