import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { GYM_RADIUS_M, type LatLng } from '@/domain/geo'

interface MapGym extends LatLng {
  id: string
  name: string
}

/**
 * Mapa das academias do grupo, com o círculo do raio em que o check-in vale.
 * Tiles do OpenStreetMap (sem chave); a atribuição aparece no canto do mapa, como a licença exige.
 */
export default function GymsMap({ gyms, here }: { gyms: MapGym[]; here: LatLng | null }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el || gyms.length === 0) return

    const map = L.map(el, {
      // No celular, arrastar o mapa com um dedo travaria a rolagem da página.
      dragging: !L.Browser.mobile,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const group = L.featureGroup()
    for (const g of gyms) {
      L.circle([g.lat, g.lng], { radius: GYM_RADIUS_M, color: '#c6f432', weight: 2, fillColor: '#c6f432', fillOpacity: 0.15 }).addTo(group)
      L.circleMarker([g.lat, g.lng], { radius: 6, color: '#11160a', weight: 2, fillColor: '#c6f432', fillOpacity: 1 })
        .bindTooltip(g.name, { permanent: gyms.length <= 3, direction: 'top', offset: [0, -6] })
        .addTo(group)
    }
    if (here) L.circleMarker([here.lat, here.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#38bdf8', fillOpacity: 1 }).bindTooltip('Você').addTo(group)
    group.addTo(map)
    // Limites pelos pontos (o círculo só sabe seu tamanho depois que o mapa tem uma vista).
    const points: L.LatLngTuple[] = gyms.map((g) => [g.lat, g.lng])
    if (here) points.push([here.lat, here.lng])
    map.fitBounds(L.latLngBounds(points).pad(0.4), { maxZoom: 17 })

    return () => {
      map.remove()
    }
  }, [gyms, here])

  return <div ref={box} className="h-64 w-full overflow-hidden rounded-xl border border-line" role="img" aria-label="Mapa das academias cadastradas" />
}
