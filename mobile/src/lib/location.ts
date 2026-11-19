/** Acesso ao GPS do aparelho (expo-location). */
import * as Location from 'expo-location'

export interface Position {
  lat: number
  lng: number
  /** Margem de erro em metros informada pelo aparelho. */
  accuracy: number
  at: number
}

/** Erro com o mesmo código do navegador: 1 = permissão negada, 2 = indisponível, 3 = demorou. */
export class LocationError extends Error {
  constructor(
    public code: 1 | 2 | 3,
    message: string,
  ) {
    super(message)
  }
}

const TIMEOUT_MS = 20_000

function toPosition(p: Location.LocationObject): Position {
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? 9999, at: p.timestamp }
}

export function locationErrorMessage(err: unknown): string {
  const code = (err as LocationError | undefined)?.code
  if (code === 1)
    return 'A localização está bloqueada. No iPhone: Ajustes > Privacidade e Segurança > Serviços de Localização > Treino a Dois > "Durante o Uso". No Android: Configurações > Apps > Treino a Dois > Permissões > Local.'
  if (code === 3) return 'O GPS demorou demais. Tente de novo perto de uma janela ou da porta.'
  return 'Não consegui pegar sua localização. Tente de novo.'
}

async function ensurePermission() {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') throw new LocationError(1, 'permissão negada')
  if (!(await Location.hasServicesEnabledAsync())) throw new LocationError(2, 'localização desligada')
}

/** Lê a posição uma vez (pede permissão na primeira vez). */
export async function getPosition(): Promise<Position> {
  await ensurePermission()
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new LocationError(3, 'tempo esgotado')), TIMEOUT_MS))
  const p = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }), timeout])
  return toPosition(p)
}

/** Acompanha a posição enquanto a tela estiver aberta. Devolve a função para parar. */
export function watchPosition(onChange: (p: Position) => void, onError: (err: LocationError) => void): () => void {
  let stopped = false
  let sub: Location.LocationSubscription | null = null
  ensurePermission()
    .then(() =>
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, timeInterval: 2000, distanceInterval: 0 },
        (p) => onChange(toPosition(p)),
        () => onError(new LocationError(2, 'indisponível')),
      ),
    )
    .then((s) => {
      if (stopped) s.remove()
      else sub = s
    })
    .catch((err) => !stopped && onError(err instanceof LocationError ? err : new LocationError(2, String(err))))
  return () => {
    stopped = true
    sub?.remove()
  }
}
