/**
 * Busca de academias pelo Google Maps (Places API "New", pelo endereço REST).
 * A chave fica em EXPO_PUBLIC_GOOGLE_MAPS_API_KEY e vai dentro do app: no Google Cloud,
 * restrinja a chave à Places API e aos apps (iOS e Android).
 */

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY

export const hasGoogleMaps = Boolean(apiKey)

export interface PlaceResult {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
}

interface ApiPlace {
  id: string
  displayName?: { text?: string } | null
  formattedAddress?: string | null
  location?: { latitude: number; longitude: number } | null
}

/** Procura lugares pelo nome, priorizando os perto de `near` (se informado). */
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  if (!apiKey) throw new Error('Busca no Google Maps não configurada')
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'pt-BR',
      regionCode: 'br',
      maxResultCount: 8,
      ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 20_000 } } } : {}),
    }),
  }).catch(() => null)
  if (!res?.ok) throw new Error('Não consegui abrir o Google Maps. Verifique a conexão.')
  const { places = [] } = (await res.json()) as { places?: ApiPlace[] }
  return places
    .filter((p) => p.location)
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? 'Sem nome',
      address: p.formattedAddress ?? '',
      lat: p.location!.latitude,
      lng: p.location!.longitude,
    }))
}
