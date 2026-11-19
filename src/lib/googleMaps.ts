/**
 * Busca de academias pelo Google Maps (Places API "New", pela Maps JavaScript API).
 * A chave fica em VITE_GOOGLE_MAPS_API_KEY e, por ir para o navegador, precisa estar
 * restrita no Google Cloud ao domínio do app (veja o README).
 */

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

export const hasGoogleMaps = Boolean(apiKey)

export interface PlaceResult {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
}

// Tipos mínimos do que usamos da biblioteca do Google (evita uma dependência só para tipos).
interface GLatLng {
  lat(): number
  lng(): number
}
interface GPlace {
  id: string
  displayName?: string | null
  formattedAddress?: string | null
  location?: GLatLng | null
}
interface PlacesLibrary {
  Place: {
    searchByText(request: {
      textQuery: string
      fields: string[]
      language?: string
      region?: string
      maxResultCount?: number
      locationBias?: { center: { lat: number; lng: number }; radius: number }
    }): Promise<{ places: GPlace[] }>
  }
}
declare global {
  interface Window {
    google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } }
    __treinoMapsReady?: () => void
  }
}

let loading: Promise<void> | null = null

function loadMaps(): Promise<void> {
  if (!apiKey) return Promise.reject(new Error('Busca no Google Maps não configurada'))
  if (window.google?.maps?.importLibrary) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    window.__treinoMapsReady = () => resolve()
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      language: 'pt-BR',
      region: 'BR',
      callback: '__treinoMapsReady',
    })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Não consegui abrir o Google Maps. Verifique a conexão.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Procura lugares pelo nome, priorizando os perto de `near` (se informado). */
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  await loadMaps()
  const { Place } = (await window.google!.maps!.importLibrary!('places')) as PlacesLibrary
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: ['id', 'displayName', 'formattedAddress', 'location'],
    language: 'pt-BR',
    region: 'br',
    maxResultCount: 8,
    ...(near ? { locationBias: { center: near, radius: 20_000 } } : {}),
  })
  return places
    .filter((p) => p.location)
    .map((p) => ({
      placeId: p.id,
      name: p.displayName ?? 'Sem nome',
      address: p.formattedAddress ?? '',
      lat: p.location!.lat(),
      lng: p.location!.lng(),
    }))
}
