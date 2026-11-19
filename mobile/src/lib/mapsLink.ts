import { extractUrl, isMapsUrl, isShortMapsUrl, placeFromShare, type ResolvedPlace, type SharedPlace } from '@domain/mapsLink'

/** Endereço do site publicado, onde roda a função /api/maps-link. */
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://treino-a-dois-theta.vercel.app').replace(/\/$/, '')

/** Lê o texto colado do Google Maps e devolve a academia (nome, endereço e posição do pino). */
export async function placeFromSharedText(text: string): Promise<SharedPlace> {
  const url = extractUrl(text)
  if (!url) throw new Error('Não achei um link no texto colado. No Google Maps, toque em Compartilhar e em Copiar link.')
  if (!isMapsUrl(url)) throw new Error('Esse link não é do Google Maps.')

  let finalUrl = url
  let resolved: ResolvedPlace | null = null
  if (isShortMapsUrl(url)) {
    const res = await fetch(`${SITE_URL}/api/maps-link?url=${encodeURIComponent(url)}`).catch(() => null)
    const body = (await res?.json().catch(() => null)) as { url?: string; place?: ResolvedPlace; error?: string } | null
    if (!res?.ok || !body?.url) throw new Error(body?.error ?? 'Não consegui abrir o link agora. Verifique a internet e tente de novo.')
    finalUrl = body.url
    resolved = body.place ?? null
  }

  const place = placeFromShare(text, finalUrl, resolved)
  if (!place)
    throw new Error(
      'Esse link não traz a posição exata da academia. Abra a página da academia no Google Maps (tocando no nome dela), toque em Compartilhar > Copiar link e cole de novo. Se não der, use "Estou na academia agora".',
    )
  return place
}
