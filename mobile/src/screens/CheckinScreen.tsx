import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Image, Linking, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Txt, useToast } from '@/components/ui'
import { useCheckins, useCreateCheckin, useGyms } from '@/data/queries'
import type { Gym } from '@/data/types'
import { dayMonth, localTime, weekdayShort } from '@domain/dates'
import { canShoot, gateFor, type Gate } from '@domain/checkinGate'
import { CHECKIN_KINDS, type CheckinKind } from '@domain/reactions'
import { GYM_RADIUS_M, formatDistance } from '@domain/geo'
import { prepareCheckinPhoto, type PreparedPhoto } from '@/lib/image'
import { locationErrorMessage, watchPosition, type Position } from '@/lib/location'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

const WHITE_10 = 'rgba(255,255,255,0.1)'
const WHITE_20 = 'rgba(255,255,255,0.2)'

export function CheckinScreen() {
  const insets = useSafeAreaInsets()
  const { group, userId, today } = useGroup()
  const create = useCreateCheckin(group.id, userId)
  const gyms = useGyms(group.id)
  const todays = useCheckins(group.id, today, today)
  const toast = useToast()

  // A câmera do app só tira foto na hora: não existe opção de escolher da galeria.
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('front')
  const [cameraReady, setCameraReady] = useState(false)
  const [photo, setPhoto] = useState<(PreparedPhoto & { position: Position | null }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [gpsError, setGpsError] = useState('')
  const [kind, setKind] = useState<CheckinKind | null>(null)

  const required = group.require_location

  // Sem academia cadastrada não há como conferir o GPS: leva para o cadastro.
  // O check-in só vale nas academias que a própria pessoa cadastrou (o banco confere igual).
  const myGyms = (gyms.data ?? []).filter((g) => g.created_by === userId)
  const noGymYet = required && gyms.isSuccess && myGyms.length === 0
  useEffect(() => {
    if (noGymYet) router.replace('/academias')
  }, [noGymYet])

  const trainedToday = (todays.data ?? []).some((c) => c.user_id === userId)
  const gate = gateFor<Gym>({
    required,
    trainedToday,
    gyms: { status: gyms.data ? 'ready' : gyms.isError ? 'error' : 'loading', list: myGyms },
    position,
    gpsError,
  })
  const locationOk = canShoot(gate)

  // Segunda barreira contra check-in repetido (a primeira é o botão da tela Início). Não dispara
  // durante o envio: o check-in recém-criado também faz "trainedToday" virar verdadeiro.
  useEffect(() => {
    if (!trainedToday || create.isPending || create.isSuccess) return
    toast('Você já registrou o treino de hoje 💪')
    router.replace('/')
  }, [trainedToday, create.isPending, create.isSuccess, toast])

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

  // Pede a câmera ao abrir a tela (na primeira vez o sistema mostra a pergunta).
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission()
  }, [permission, requestPermission])

  async function capture() {
    const camera = cameraRef.current
    if (!camera || !cameraReady) return
    setBusy(true)
    try {
      const shot = await camera.takePictureAsync({ base64: true, quality: 0.9, shutterSound: false })
      if (!shot?.base64) throw new Error('Não foi possível tirar a foto')
      const prepared = prepareCheckinPhoto(shot.base64, stamp())
      setPhoto({ ...prepared, position })
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
    create.mutate(
      { photo: photo.bytes, position: sent, kind },
      {
        onSuccess: () => {
          toast('Treino registrado! 💪')
          router.replace('/')
        },
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    )
  }

  const cameraDenied = permission !== null && !permission.granted && !permission.canAskAgain

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <View
        style={{
          paddingTop: Math.max(insets.top, 12),
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ borderRadius: 999, backgroundColor: WHITE_10, paddingHorizontal: 12, paddingVertical: 6 }}
          accessibilityRole="button"
        >
          <Txt size={14} color={colors.white}>
            Cancelar
          </Txt>
        </Pressable>
        <Txt size={14} color="rgba(255,255,255,0.7)">
          Foto na academia
        </Txt>
        <View style={{ width: 64 }} />
      </View>

      <LocationBanner gate={gate} onRetry={() => void gyms.refetch()} retrying={gyms.isFetching} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel="Prévia do check-in" />
        ) : !permission ? (
          <Txt size={14} color="rgba(255,255,255,0.6)">
            Abrindo a câmera…
          </Txt>
        ) : !permission.granted ? (
          <View style={{ maxWidth: 320, gap: 16, paddingHorizontal: 24, alignItems: 'center' }}>
            <Txt color="rgba(255,255,255,0.8)" center>
              {cameraDenied
                ? 'Não consegui abrir a câmera. Libere o acesso nos Ajustes do celular (Treino a Dois > Câmera).'
                : 'O app precisa da câmera para tirar a foto do treino.'}
            </Txt>
            <Button onPress={() => (cameraDenied ? Linking.openSettings() : requestPermission())}>
              {cameraDenied ? 'Abrir os Ajustes' : 'Liberar a câmera'}
            </Button>
          </View>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={{ width: '100%', height: '100%' }}
              facing={facing}
              mode="picture"
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => toast('Não consegui abrir a câmera. Libere o acesso nos Ajustes do celular.', 'error')}
            />
            {!cameraReady && (
              <Txt size={14} color="rgba(255,255,255,0.6)" style={{ position: 'absolute' }}>
                Abrindo a câmera…
              </Txt>
            )}
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 8) }}>
        {photo ? (
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }} accessibilityLabel="Tipo de treino (opcional)">
              {(Object.keys(CHECKIN_KINDS) as CheckinKind[]).map((k) => (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === k }}
                  onPress={() => setKind(kind === k ? null : k)}
                  style={{
                    minHeight: 36,
                    justifyContent: 'center',
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    borderColor: kind === k ? colors.accent : WHITE_20,
                    backgroundColor: kind === k ? alpha(colors.accent, 0.2) : WHITE_10,
                  }}
                >
                  <Txt size={14} color={kind === k ? colors.white : 'rgba(255,255,255,0.8)'}>
                    {CHECKIN_KINDS[k]}
                  </Txt>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                variant="secondary"
                style={{ flex: 1, borderColor: WHITE_20, backgroundColor: WHITE_10 }}
                textStyle={{ color: colors.white }}
                onPress={() => setPhoto(null)}
                disabled={create.isPending}
              >
                Tirar outra
              </Button>
              <Button style={{ flex: 1 }} onPress={send} loading={create.isPending}>
                Registrar treino
              </Button>
            </View>
          </View>
        ) : permission?.granted ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
            <View style={{ width: 56 }} />
            <Pressable
              accessibilityLabel="Tirar foto"
              accessibilityRole="button"
              onPress={capture}
              disabled={!cameraReady || busy || !locationOk}
              style={({ pressed }) => ({
                width: 76,
                height: 76,
                borderRadius: 38,
                borderWidth: 4,
                borderColor: locationOk ? colors.accent : 'rgba(255,255,255,0.4)',
                backgroundColor: locationOk ? alpha(colors.accent, 0.3) : WHITE_10,
                opacity: !cameraReady || busy || !locationOk ? 0.4 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            />
            <Pressable
              accessibilityLabel="Trocar câmera"
              accessibilityRole="button"
              onPress={() => {
                setCameraReady(false)
                setFacing((f) => (f === 'front' ? 'back' : 'front'))
              }}
              style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: WHITE_10, alignItems: 'center', justifyContent: 'center' }}
            >
              <Txt size={20} color={colors.white}>
                ⟲
              </Txt>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
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
          Você ainda não cadastrou a sua academia.{' '}
          <Txt size={14} color={colors.white} style={{ textDecorationLine: 'underline' }} onPress={() => router.replace('/academias')}>
            Cadastrar agora
          </Txt>
        </>
      )
      break
    case 'gyms-error':
      tone = 'warn'
      text = (
        <>
          Não consegui carregar as academias.{' '}
          <Txt size={14} color={colors.white} style={{ textDecorationLine: 'underline' }} onPress={retrying ? undefined : onRetry}>
            {retrying ? 'Tentando…' : 'Tentar de novo'}
          </Txt>
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
    ok: { bg: alpha(colors.accent, 0.9), fg: colors.accentInk },
    warn: { bg: alpha(colors.danger, 0.9), fg: colors.white },
    wait: { bg: WHITE_10, fg: 'rgba(255,255,255,0.8)' },
  }[tone]
  return (
    <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: styles.bg }}>
      <Txt size={14} color={styles.fg} center>
        {text}
      </Txt>
    </View>
  )
}
