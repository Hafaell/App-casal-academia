/** Acesso ao GPS do aparelho. */

export interface Position {
  lat: number
  lng: number
  /** Margem de erro em metros informada pelo aparelho. */
  accuracy: number
  at: number
}

const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }

function toPosition(p: GeolocationPosition): Position {
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp }
}

export function locationErrorMessage(err: unknown): string {
  const code = (err as GeolocationPositionError | undefined)?.code
  if (code === 1)
    return 'A localização está bloqueada. No iPhone: Ajustes > Privacidade e Segurança > Serviços de Localização > Safari (ou o app) > "Durante o Uso".'
  if (code === 3) return 'O GPS demorou demais. Tente de novo perto de uma janela ou da porta.'
  if (!('geolocation' in navigator)) return 'Este navegador não oferece localização.'
  return 'Não consegui pegar sua localização. Tente de novo.'
}

/** Lê a posição uma vez (pede permissão na primeira vez). */
export function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Este navegador não oferece localização.'))
    navigator.geolocation.getCurrentPosition((p) => resolve(toPosition(p)), reject, OPTIONS)
  })
}

/** Acompanha a posição enquanto a tela estiver aberta. Devolve a função para parar. */
export function watchPosition(onChange: (p: Position) => void, onError: (err: GeolocationPositionError) => void): () => void {
  if (!('geolocation' in navigator)) {
    onError({ code: 2, message: 'sem geolocalização' } as GeolocationPositionError)
    return () => {}
  }
  const id = navigator.geolocation.watchPosition((p) => onChange(toPosition(p)), onError, OPTIONS)
  return () => navigator.geolocation.clearWatch(id)
}
