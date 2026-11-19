import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Circle, Marker, type MapPressEvent } from 'react-native-maps'
import { Button, Input, ToastHost, Txt } from '@/components/ui'
import { GYM_RADIUS_M, formatDistance, distanceMeters, type LatLng } from '@domain/geo'
import { nominatimUrl, parseNominatim, type OsmPlace } from '@domain/osmSearch'
import { alpha, colors } from '@/lib/theme'

export interface PickedGym {
  name: string
  address: string
  lat: number
  lng: number
}

interface Props {
  /** Onde o mapa abre: sua posição, se houver; senão a academia já cadastrada. */
  center: LatLng | null
  /** Academias que já existem, mostradas em cinza. */
  gyms: (LatLng & { name: string })[]
  here: LatLng | null
  busy: boolean
  onConfirm: (g: PickedGym) => void
  onClose: () => void
}

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng })

/**
 * Escolher a academia no mapa, dentro do app: toque no mapa (ou arraste o pino) onde ela fica,
 * ou procure pelo nome (busca do OpenStreetMap, sem chave). O satélite ajuda a achar o prédio.
 */
export default function GymPicker({ center, gyms, here, busy, onConfirm, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const map = useRef<MapView>(null)
  const [pin, setPin] = useState<LatLng | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [satellite, setSatellite] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OsmPlace[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  function place(at: LatLng, zoomIn = false) {
    setPin({ lat: at.lat, lng: at.lng })
    if (zoomIn) map.current?.animateToRegion({ ...toCoord(at), latitudeDelta: 0.004, longitudeDelta: 0.004 }, 300)
  }

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      // O Nominatim pede que cada app se identifique (política de uso do OpenStreetMap).
      const res = await fetch(nominatimUrl(query, center ?? here ?? undefined), {
        headers: { Accept: 'application/json', 'User-Agent': 'TreinoADois/0.1 (app do casal)' },
      })
      if (!res.ok) throw new Error(String(res.status))
      setResults(parseNominatim(await res.json()))
    } catch {
      setResults(null)
      setSearchError('Não consegui buscar agora. Toque no mapa para marcar o lugar.')
    } finally {
      setSearching(false)
    }
  }

  function choose(r: OsmPlace) {
    place(r, true)
    setName(r.name)
    setAddress(r.address)
    setResults(null)
  }

  function submit() {
    if (pin && name.trim()) onConfirm({ name: name.trim(), address, lat: pin.lat, lng: pin.lng })
  }

  const away = pin && here ? formatDistance(distanceMeters(here, pin)) : null
  const start = center ?? { lat: -14.235, lng: -51.925 } // sem posição: Brasil inteiro
  const delta = center ? 0.005 : 30

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            paddingTop: Math.max(insets.top, 12),
            paddingHorizontal: 12,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Pressable onPress={onClose} style={pill(false)} accessibilityRole="button">
            <Txt size={14}>Fechar</Txt>
          </Pressable>
          <Txt size={14} weight="600">
            Escolher no mapa
          </Txt>
          <Pressable onPress={() => setSatellite((s) => !s)} style={pill(satellite)} accessibilityRole="switch" accessibilityState={{ checked: satellite }}>
            <Txt size={14} color={satellite ? colors.accentInk : colors.ink}>
              🛰️ Satélite
            </Txt>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Buscar pelo nome (ex.: Smart Fit Guarapari)"
              value={query}
              onChangeText={setQuery}
              maxLength={120}
              returnKeyType="search"
              onSubmitEditing={search}
            />
          </View>
          <Button onPress={search} loading={searching}>
            Buscar
          </Button>
        </View>

        {(results || searchError) && (
          <ScrollView
            style={{ marginHorizontal: 12, marginBottom: 8, maxHeight: 176, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}
            keyboardShouldPersistTaps="handled"
          >
            {searchError ? (
              <Txt size={14} color={colors.danger} style={{ padding: 12 }}>
                {searchError}
              </Txt>
            ) : null}
            {results?.length === 0 && (
              <Txt size={14} muted style={{ padding: 12 }}>
                Esse lugar pode não estar no mapa aberto. Toque no mapa onde ele fica ou use "Buscar no Google Maps" na tela anterior.
              </Txt>
            )}
            {results?.map((r, i) => (
              <Pressable
                key={`${r.lat},${r.lng},${i}`}
                onPress={() => choose(r)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
              >
                <Txt size={14} weight="600" numberOfLines={1}>
                  {r.name}
                </Txt>
                <Txt size={12} muted numberOfLines={1}>
                  {r.address}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={{ flex: 1 }} accessibilityLabel="Mapa para marcar a academia">
          <MapView
            ref={map}
            style={{ flex: 1 }}
            mapType={satellite ? 'hybrid' : 'standard'}
            initialRegion={{ ...toCoord(start), latitudeDelta: delta, longitudeDelta: delta }}
            onPress={(e: MapPressEvent) => {
              const c = e.nativeEvent.coordinate
              place({ lat: c.latitude, lng: c.longitude })
              setAddress('')
            }}
            toolbarEnabled={false}
          >
            {gyms.map((g, i) => (
              <Circle key={`g-${i}`} center={toCoord(g)} radius={GYM_RADIUS_M} strokeColor={colors.muted} strokeWidth={1} fillColor={alpha(colors.muted, 0.1)} />
            ))}
            {here && <Marker coordinate={toCoord(here)} title="Você" pinColor="#38bdf8" />}
            {pin && (
              <>
                <Circle center={toCoord(pin)} radius={GYM_RADIUS_M} strokeColor={colors.accent} strokeWidth={2} fillColor={alpha(colors.accent, 0.15)} />
                <Marker
                  coordinate={toCoord(pin)}
                  draggable
                  onDragEnd={(e) => {
                    const c = e.nativeEvent.coordinate
                    setPin({ lat: c.latitude, lng: c.longitude })
                    setAddress('') // o endereço da busca não vale mais para outro ponto
                  }}
                  title={name || 'Academia'}
                />
              </>
            )}
          </MapView>
        </View>

        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface, padding: 12, paddingBottom: Math.max(insets.bottom, 8) + 4 }}>
          {!pin ? (
            <Txt size={14} muted center>
              Toque no mapa onde fica a academia, ou busque pelo nome.
            </Txt>
          ) : (
            <>
              <Input placeholder="Nome da academia" value={name} onChangeText={setName} maxLength={80} />
              <Txt size={12} muted>
                {address || 'Arraste o pino ou toque em outro ponto para ajustar.'} O check-in vale a até {GYM_RADIUS_M} m deste ponto
                {away ? ` (você está a ${away})` : ''}.
              </Txt>
              <Button onPress={submit} loading={busy} disabled={!name.trim()}>
                Cadastrar academia aqui
              </Button>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  )
}

const pill = (active: boolean) => ({
  borderRadius: 999,
  paddingHorizontal: 12,
  paddingVertical: 6,
  backgroundColor: active ? colors.accent : colors.surface,
})
