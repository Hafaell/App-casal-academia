import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useGroup } from '@/app/GroupProvider'
import { Button, useToast } from '@/components/ui'
import { useCheckins, useCreateCheckin, useGyms } from '@/data/queries'
import type { Gym } from '@/data/types'
import { dayMonth, localTime, weekdayShort } from '@/domain/dates'
import { canShoot, gateFor, type Gate } from '@/domain/checkinGate'
import { GYM_RADIUS_M, formatDistance } from '@/domain/geo'
import { loadImage, prepareCheckinPhoto } from '@/lib/image'
import { locationErrorMessage, watchPosition, type Position } from '@/lib/location'
import { errorMessage } from '@/lib/supabase'

type Facing = 'user' | 'environment'

/** Foto do arquivo precisa ser recém-tirada (a galeria não é oferecida). */
const MAX_FILE_AGE_MS = 5 * 60 * 1000

export function CheckinPage() {
  const { group, userId, today } = useGroup()
  const create = useCreateCheckin(group.id, userId)
  const gyms = useGyms(group.id)
  const todays = useCheckins(group.id, today, today)
  const navigate = useNavigate()
  const toast = useToast()

  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; position: Position | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [gpsError, setGpsError] = useState('')

  const required = group.require_location

  // Sem academia cadastrada não há como conferir o GPS: leva para o cadastro (também vale para quem abre o endereço direto).
  const noGymYet = required && gyms.isSuccess && gyms.data.length === 0
  useEffect(() => {
    if (noGymYet) navigate('/academias', { replace: true })
  }, [noGymYet, navigate])

  const trainedToday = (todays.data ?? []).some((c) => c.user_id === userId)
  const gate = gateFor<Gym>({
    required,
    trainedToday,
    gyms: { status: gyms.data ? 'ready' : gyms.isError ? 'error' : 'loading', list: gyms.data ?? [] },
    position,
    gpsError,
  })
  const locationOk = canShoot(gate)

  // Segunda barreira contra check-in repetido (a primeira é o botão da tela Início). Não dispara
  // durante o envio: o check-in recém-criado também faz "trainedToday" virar verdadeiro.
  useEffect(() => {
    if (!trainedToday || create.isPending || create.isSuccess) return
    toast('Você já registrou o treino de hoje 💪')
    navigate('/', { replace: true })
  }, [trainedToday, create.isPending, create.isSuccess, navigate, toast])

  const stamp = () => {
    const where = gate.kind === 'ok' ? gate.place.name : group.name
    return `${weekdayShort(today)} ${dayMonth(today)} · ${localTime(new Date(), group.timezone)} · ${where}`
  }

  // GPS ligado enquanto a tela estiver aberta e só se a regra exigir: o aviso de distância atualiza sozinho.
  useEffect(() => {
    if (!required) return
    return watchPosition(
      (p) => {
        setPosition(p)
        setGpsError('')
      },
      (err) => setGpsError(locationErrorMessage(err)),
    )
  }, [required])

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
      const blob = await prepareCheckinPhoto(video, video.videoWidth, video.videoHeight, stamp())
      setPhoto({ blob, url: URL.createObjectURL(blob), position })
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
    if (!locationOk) {
      toast('Você precisa estar na academia para registrar o treino.', 'error')
      return
    }
    if (Date.now() - file.lastModified > MAX_FILE_AGE_MS) {
      toast('A foto precisa ser tirada agora, na academia.', 'error')
      return
    }
    setBusy(true)
    try {
      const img = await loadImage(file)
      const blob = await prepareCheckinPhoto(img, img.naturalWidth, img.naturalHeight, stamp())
      URL.revokeObjectURL(img.src)
      setPhoto({ blob, url: URL.createObjectURL(blob), position })
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  function send() {
    if (!photo) return
    // A posição vai junto com a foto; o banco confere de novo o raio (GYM_RADIUS_M).
    const pos = photo.position ?? position
    if (required && !pos) return toast('Ainda sem localização. Espere o GPS e tente de novo.', 'error')
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

      <LocationBanner gate={gate} onRetry={() => void gyms.refetch()} retrying={gyms.isFetching} />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {photo ? (
          <img src={photo.url} alt="Prévia do check-in" className="max-h-full max-w-full object-contain" />
        ) : cameraError ? (
          <div className="max-w-xs space-y-4 px-6 text-center">
            <p className="text-white/80">{cameraError}</p>
            <label
              aria-disabled={!locationOk}
              className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-accent px-5 font-semibold text-accent-ink ${locationOk ? '' : 'pointer-events-none opacity-40'}`}
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
              disabled={!cameraReady || busy || !locationOk}
              className={`h-[76px] w-[76px] rounded-full border-4 transition active:scale-95 disabled:opacity-40 ${
                locationOk ? 'border-accent bg-accent/30' : 'border-white/40 bg-white/10'
              }`}
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

/** Faixa com o estado do check-in: dentro do raio, longe, sem academia, buscando… */
function LocationBanner({ gate, onRetry, retrying }: { gate: Gate<Gym>; onRetry: () => void; retrying: boolean }) {
  let tone: 'ok' | 'warn' | 'wait' = 'wait'
  let text: ReactNode = 'Buscando sua localização…'

  switch (gate.kind) {
    case 'ok':
      tone = 'ok'
      text = `📍 ${gate.place.name} · ${formatDistance(gate.distance)}`
      break
    case 'far':
      tone = 'warn'
      text = `Você está a ${formatDistance(gate.distance)} de ${gate.place.name}. Precisa estar a até ${GYM_RADIUS_M} m.`
      break
    case 'no-gym':
      tone = 'warn'
      text = (
        <>
          Nenhuma academia cadastrada.{' '}
          <Link to="/academias" className="underline">
            Cadastrar agora
          </Link>
        </>
      )
      break
    case 'gyms-error':
      tone = 'warn'
      text = (
        <>
          Não consegui carregar as academias.{' '}
          <button className="underline" onClick={onRetry} disabled={retrying}>
            {retrying ? 'Tentando…' : 'Tentar de novo'}
          </button>
        </>
      )
      break
    case 'gps-error':
      tone = 'warn'
      text = gate.message
      break
    case 'weak-signal':
      text = `GPS impreciso (±${Math.round(gate.accuracy)} m). Aguarde alguns segundos…`
      break
    case 'free':
      text = gate.place ? `📍 ${gate.place.name} · ${formatDistance(gate.distance ?? 0)}` : 'Este grupo não exige estar na academia.'
      break
    case 'trained':
      text = 'Você já registrou o treino de hoje.'
      break
    case 'gyms-loading':
    case 'waiting-gps':
      break
  }

  const styles = {
    ok: 'bg-accent/90 text-accent-ink',
    warn: 'bg-danger/90 text-white',
    wait: 'bg-white/10 text-white/80',
  }
  return (
    <div role="status" className={`mx-4 mb-2 rounded-xl px-3 py-2 text-center text-sm ${styles[tone]}`}>
      {text}
    </div>
  )
}
