/**
 * Quando o link do app do Google Maps (iPhone) vem sem coordenadas
 * (`maps.google.com/?q=<nome e endereço>&ftid=<id do lugar>`), a posição exata do lugar
 * está no endereço "embed" do Google, que não precisa de chave.
 * Arquivo com "_" no início não vira rota da Vercel.
 */

export interface EmbedPlace {
  lat: number
  lng: number
  address: string
}

export function embedUrl(q: string, ftid: string): string {
  return `https://maps.google.com/maps?${new URLSearchParams({ q, ftid, output: 'embed', hl: 'pt-BR' })}`
}

/**
 * Procura no HTML o registro `["<ftid>","<título>",[lat,lng],"<cid>"]` do lugar pedido.
 * Exige o mesmo ftid do link: se o Google devolver outro lugar, não usamos.
 */
export function parseEmbed(html: string, ftid: string): EmbedPlace | null {
  const id = ftid.toLowerCase()
  const re = /\["(0x[0-9a-f]+:0x[0-9a-f]+)","[^"]*",\[(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)\]/gi
  for (const m of html.matchAll(re)) {
    if (m[1].toLowerCase() !== id) continue
    const lat = Number(m[2])
    const lng = Number(m[3])
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    // Endereço em partes, logo depois do nome: ["R. X, 1 - Bairro","Cidade - UF","CEP"]
    const after = html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 1500)
    const parts = after.match(/\["([^"\]]{3,120})","([^"\]]{3,80})"(?:,"([^"\]]{3,20})")?\]/)
    const address = parts ? [parts[1], parts[2], parts[3]].filter(Boolean).join(', ').replace(/,\s*(Brasil|Brazil)$/i, '') : ''
    return { lat, lng, address }
  }
  return null
}
