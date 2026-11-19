import { useRef } from 'react'
import { View } from 'react-native'
import MapView, { Circle, Marker } from 'react-native-maps'
import { GYM_RADIUS_M, type LatLng } from '@domain/geo'
import { alpha, colors } from '@/lib/theme'

interface MapGym extends LatLng {
  id: string
  name: string
}

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng })

/** Mapa das academias do grupo, com o círculo do raio em que o check-in vale. */
export default function GymsMap({ gyms, here }: { gyms: MapGym[]; here: LatLng | null }) {
  const map = useRef<MapView>(null)
  if (gyms.length === 0) return null

  const points = [...gyms, ...(here ? [here] : [])].map(toCoord)
  const fit = () => map.current?.fitToCoordinates(points, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: false })

  return (
    <View
      style={{ height: 256, width: '100%', overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.line }}
      accessibilityLabel="Mapa das academias cadastradas"
    >
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={{ ...toCoord(gyms[0]), latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        onMapReady={fit}
        // No celular, arrastar o mapa com um dedo travaria a rolagem da tela.
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {gyms.map((g) => (
          <Circle
            key={`c-${g.id}`}
            center={toCoord(g)}
            radius={GYM_RADIUS_M}
            strokeColor={colors.accent}
            strokeWidth={2}
            fillColor={alpha(colors.accent, 0.15)}
          />
        ))}
        {gyms.map((g) => (
          <Marker key={`m-${g.id}`} coordinate={toCoord(g)} title={g.name} pinColor={colors.accent} />
        ))}
        {here && <Marker coordinate={toCoord(here)} title="Você" pinColor="#38bdf8" />}
      </MapView>
    </View>
  )
}
