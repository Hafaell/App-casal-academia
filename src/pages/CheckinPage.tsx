import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useGroup } from '@/app/GroupProvider'
import { Button, useToast } from '@/components/ui'
import { useCreateCheckin, useGyms } from '@/data/queries'
import type { Gym } from '@/data/types'
import { dayMonth, localTime, weekdayShort } from '@/domain/dates'
import { GYM_RADIUS_M, MAX_ACCURACY_M, checkLocation, formatDistance, type LocationCheck } from '@/domain/geo'
import { loadImage, prepareCheckinPhoto } from '@/lib/image'
import { getPosition, locationErrorMessage, type Position } from '@/lib/location'
import { errorMessage } from '@/lib/supabase'

type Facing = 'user' | 'environment'

/** Foto do arquivo precisa ser recém-tirada (a galeria não é oferecida). */
const MAX_FILE_AGE_MS = 5 * 60 * 1000

export function CheckinPage() {
  const { group, userId, today } = useGroup()
  const create = useCreateCheckin(group.id, userId)
  const gyms = useGyms(group.id)
  const navigate = useNavigate()
  const toast = useToast()

  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; position: Position | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  // Resultado da última verificação (só existe depois de tocar para tirar a foto).
  const [check, setCheck] = useState<LocationCheck<Gym> | null>(null)
  const [gpsError, setGpsError] = useState('')

  const required = group.require_location
  // Sem academia cadastrada nem adianta abrir o GPS.
  const noGym = required && gyms.data?.length === 0
  const canShoot = !noGym && !gyms.isLoading && !locating

  const stamp = (where: string) =>
    `${weekdayShort(today)} ${dayMonth(today)} · ${localTime(new Date(), group.timezone)} · ${where}`

  /**
   * Lê o GPS uma única vez, no momento da foto. Se a primeira leitura vier imprecisa
   * (comum logo que o GPS acorda), tenta mais uma vez antes de desistir.
   * Devolve null quando a foto não pode ser usada.
   */
  async function locate(): Promise<{ position: Position | null; where: string } | null> {
    setLocating(true)
    setGpsError('')
    setCheck(null)
    try {
      let position = await getPosition()
      if (position.accuracy > MAX_ACCURACY_M) position = await getPosition()
      const result = checkLocation(position, gyms.data ?? [])
      setCheck(result)
      if (result.status === 'ok') return { position, where: result.place.name }
      if (required) return null
      return { position, where: group.name }
    } catch (err) {
      setGpsError(locationErrorMessage(err))
      // Com a regra desligada, a foto vale mesmo sem localização.
      return required ? null : { position: null, where: group.name }
    } finally {
      setLocating(false)
    }
  }

  // Liga a câmera ao vivo. Sem câmera ao vivo não há como escolher foto antiga.
  useEffect(() => {
    if (photo) return
    let stream: MediaStream | null = null
    let cancelled = false
    setCameraReady(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador não liberou a câmera ao vivo.')
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        await video.play().catch(() => undefined)
        setCameraReady(true)
        setCameraError('')
      })
      .catch(() => setCameraError('Não consegui abrir a câmera. Libere o acesso nas configurações do iPhone.'))

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing, photo])

  // Libera a memória da prévia.
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo])

  async function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setBusy(true)
    try {
      // Congela o quadro no instante do toque e só então consulta o GPS.
      const frame = document.createElement('canvas')
      frame.width = video.videoWidth
      frame.height = video.videoHeight
      frame.getContext('2d')?.drawImage(video, 0, 0)
      video.pause()
      const located = await locate()
      if (!located) {
        await video.play().catch(() => undefined)
        return
      }
      const blob = await prepareCheckinPhoto(frame, frame.width, frame.height, stamp(located.where))
      setPhoto({ blob, url: URL.createObjectURL(blob), position: located.position })
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  // Plano B: câmera nativa do iPhone (capture="environment" abre a câmera direto).
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (Date.now() - file.lastModified > MAX_FILE_AGE_MS) {
      toast('A foto precisa ser tirada agora, na academia.', 'error')
      return
    }
    setBusy(true)
    try {
      const located = await locate()
      if (!located) return
      const img = await loadImage(file)
      const blob = await prepareCheckinPhoto(img, img.naturalWidth, img.naturalHeight, stamp(located.where))
      URL.revokeObjectURL(img.src)
      setPhoto({ blob, url: URL.createObjectURL(blob), position: located.position })
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  function send() {
    if (!photo) return
    // A posição lida no momento da foto vai junto; o banco confere de novo os 300 m.
    const pos = photo.position
    const sent = pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : null
    create.mutate({ photo: photo.blob, position: sent }, {
      onSuccess: () => {
        toast('Treino registrado! 💪')
        navigate('/', { replace: true })
      },
      onError: (err) => toast(errorMessage(err), 'error'),
    })
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <div className="safe-top flex items-center justify-between px-4 pb-2">
        <button className="rounded-full bg-white/10 px-3 py-1.5 text-sm" onClick={() => navigate(-1)}>
          Cancelar
        </button>
        <span className="text-sm text-white/70">Foto na academia</span>
        <span className="w-16" />
      </div>

      <LocationBanner required={required} noGym={noGym} locating={locating} check={check} gpsError={gpsError} />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {photo ? (
          <img src={photo.url} alt="Prévia do check-in" className="max-h-full max-w-full object-contain" />
        ) : cameraError ? (
          <div className="max-w-xs space-y-4 px-6 text-center">
            <p className="text-white/80">{cameraError}</p>
            <label
              aria-disabled={!canShoot}
              className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-accent px-5 font-semibold text-accent-ink ${canShoot ? '' : 'pointer-events-none opacity-40'}`}
            >
              Abrir câmera do iPhone
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
            </label>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
              style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined}
            />
            {!cameraReady && <p className="absolute text-sm text-white/60">Abrindo a câmera…</p>}
            {locating && (
              <p className="absolute rounded-xl bg-black/70 px-4 py-2 text-sm">📍 Verificando sua localização…</p>
            )}
          </>
        )}
      </div>

      <div className="safe-bottom px-6 pt-4">
        {photo ? (
          <div className="flex gap-3 pb-2">
            <Button variant="secondary" className="flex-1 !border-white/20 !bg-white/10 !text-white" onClick={() => setPhoto(null)} disabled={create.isPending}>
              Tirar outra
            </Button>
            <Button className="flex-1" onClick={send} loading={create.isPending}>
              Registrar treino
            </Button>
          </div>
        ) : !cameraError ? (
          <div className="flex items-center justify-between pb-2">
            <span className="w-14" />
            <button
              aria-label="Tirar foto"
              onClick={capture}
              disabled={!cameraReady || busy || !canShoot}
              className="h-[76px] w-[76px] rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40"
            />
            <button
              aria-label="Trocar câmera"
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-xl"
            >
              ⟲
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Faixa com o resultado da verificação. Antes da foto, só explica o que vai acontecer. */
function LocationBanner({
  required,
  noGym,
  locating,
  check,
  gpsError,
}: {
  required: boolean
  noGym: boolean
  locating: boolean
  check: LocationCheck<Gym> | null
  gpsError: string
}) {
  let tone: 'ok' | 'warn' | 'info' = 'info'
  let text: ReactNode = required
    ? `Ao tirar a foto, o app confere se você está a até ${GYM_RADIUS_M} m da academia.`
    : null

  if (noGym) {
    tone = 'warn'
    text = (
      <>
        Nenhuma academia cadastrada.{' '}
        <Link to="/academias" className="underline">
          Cadastrar agora
        </Link>
      </>
    )
  } else if (locating) {
    text = 'Verificando sua localização…'
  } else if (gpsError) {
    tone = 'warn'
    text = gpsError
  } else if (check?.status === 'ok') {
    tone = 'ok'
    text = `📍 ${check.place.name} · ${formatDistance(check.distance)}`
  } else if (check?.status === 'far') {
    tone = 'warn'
    text = `Você está a ${formatDistance(check.distance)} de ${check.place.name}. Precisa estar a até ${GYM_RADIUS_M} m.`
  } else if (check?.status === 'weak-signal') {
    tone = 'warn'
    text = `GPS impreciso (±${Math.round(check.accuracy)} m). Vá para perto de uma janela e tire a foto de novo.`
  }

  if (!text) return null
  // Com a regra desligada, o aviso só informa (não bloqueia).
  if (!required && tone === 'warn') tone = 'info'

  const styles = {
    ok: 'bg-accent/90 text-accent-ink',
    warn: 'bg-danger/90 text-white',
    info: 'bg-white/10 text-white/80',
  }
  return (
    <div role="status" className={`mx-4 mb-2 rounded-xl px-3 py-2 text-center text-sm ${styles[tone]}`}>
      {text}
    </div>
  )
}
