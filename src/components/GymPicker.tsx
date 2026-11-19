import { useEffect, useRef, useState, type FormEvent } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button, inputClass } from '@/components/ui'
import { GYM_RADIUS_M, formatDistance, distanceMeters, type LatLng } from '@/domain/geo'
import { nominatimUrl, parseNominatim, type OsmPlace } from '@/domain/osmSearch'

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

const OSM = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}
const SAT = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics',
  maxZoom: 19,
}

const PIN = L.divIcon({
  className: '',
  html: '<div style="font-size:34px;line-height:34px;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))">📍</div>',
  iconSize: [0, 0],
})

/**
 * Escolher a academia no mapa, dentro do app: toque no mapa (ou arraste o pino) onde ela fica,
 * ou procure pelo nome. Mapa do OpenStreetMap, sem chave; o satélite ajuda a achar o prédio.
 */
export default function GymPicker({ center, gyms, here, busy, onConfirm, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const tilesRef = useRef<L.TileLayer | null>(null)

  const [pin, setPin] = useState<LatLng | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [satellite, setSatellite] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OsmPlace[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  function place(at: LatLng, zoom?: number) {
    const map = mapRef.current
    if (!map) return
    const ll = L.latLng(at.lat, at.lng)
    if (!markerRef.current) {
      markerRef.current = L.marker(ll, { icon: PIN, draggable: true }).addTo(map)
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng()
        circleRef.current?.setLatLng(p)
        setPin({ lat: p.lat, lng: p.lng })
        setAddress('') // o endereço da busca não vale mais para outro ponto
      })
      circleRef.current = L.circle(ll, { radius: GYM_RADIUS_M, color: '#c6f432', weight: 2, fillColor: '#c6f432', fillOpacity: 0.15, interactive: false }).addTo(map)
    } else {
      markerRef.current.setLatLng(ll)
      circleRef.current?.setLatLng(ll)
    }
    setPin({ lat: at.lat, lng: at.lng })
    if (zoom) map.setView(ll, zoom)
  }

  // Cria o mapa uma vez.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(
      center ? [center.lat, center.lng] : [-14.235, -51.925], // sem posição: Brasil inteiro
      center ? 17 : 4,
    )
    mapRef.current = map
    tilesRef.current = L.tileLayer(OSM.url, OSM).addTo(map)
    for (const g of gyms)
      L.circle([g.lat, g.lng], { radius: GYM_RADIUS_M, color: '#8b97a8', weight: 1, fillOpacity: 0.1, interactive: false })
        .bindTooltip(g.name, { permanent: false })
        .addTo(map)
    if (here) L.circleMarker([here.lat, here.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#38bdf8', fillOpacity: 1, interactive: false }).addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => {
      place({ lat: e.latlng.lat, lng: e.latlng.lng })
      setAddress('')
    })
    return () => {
      map.remove()
      mapRef.current = markerRef.current = circleRef.current = tilesRef.current = null
    }
    // O mapa é criado uma vez; as props só definem o ponto de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Troca entre mapa e satélite.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    tilesRef.current?.remove()
    const t = satellite ? SAT : OSM
    tilesRef.current = L.tileLayer(t.url, t).addTo(map)
    tilesRef.current.bringToBack()
  }, [satellite])

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      const res = await fetch(nominatimUrl(query, center ?? here ?? undefined), { headers: { Accept: 'application/json' } })
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
    place(r, 18)
    setName(r.name)
    setAddress(r.address)
    setResults(null)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (pin && name.trim()) onConfirm({ name: name.trim(), address, lat: pin.lat, lng: pin.lng })
  }

  const away = pin && here ? formatDistance(distanceMeters(here, pin)) : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="safe-top flex items-center justify-between gap-2 px-3 pb-2">
        <button className="rounded-full bg-surface px-3 py-1.5 text-sm" onClick={onClose}>
          Fechar
        </button>
        <span className="text-sm font-semibold">Escolher no mapa</span>
        <button
          className={`rounded-full px-3 py-1.5 text-sm ${satellite ? 'bg-accent text-accent-ink' : 'bg-surface'}`}
          onClick={() => setSatellite((s) => !s)}
          aria-pressed={satellite}
        >
          🛰️ Satélite
        </button>
      </div>

      <form onSubmit={search} className="flex gap-2 px-3 pb-2">
        <input
          className={inputClass}
          placeholder="Buscar pelo nome (ex.: Smart Fit Guarapari)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={120}
        />
        <Button type="submit" loading={searching}>
          Buscar
        </Button>
      </form>

      {(results || searchError) && (
        <ul className="mx-3 mb-2 max-h-44 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
          {searchError && <li className="p-3 text-sm text-danger">{searchError}</li>}
          {results?.length === 0 && <li className="p-3 text-sm text-muted">Esse lugar pode não estar no mapa aberto. Toque no mapa onde ele fica ou use "Buscar no Google Maps" na tela anterior.</li>}
          {results?.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button className="block w-full px-3 py-2 text-left" onClick={() => choose(r)}>
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="truncate text-xs text-muted">{r.address}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={box} className="min-h-0 flex-1" role="application" aria-label="Mapa para marcar a academia" />

      <form onSubmit={submit} className="safe-bottom space-y-2 border-t border-line bg-surface p-3">
        {!pin ? (
          <p className="text-center text-sm text-muted">Toque no mapa onde fica a academia, ou busque pelo nome.</p>
        ) : (
          <>
            <input
              className={inputClass}
              placeholder="Nome da academia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
            <p className="text-xs text-muted">
              {address || 'Arraste o pino ou toque em outro ponto para ajustar.'} O check-in vale a até {GYM_RADIUS_M} m deste ponto
              {away ? ` (você está a ${away})` : ''}.
            </p>
            <Button type="submit" className="w-full" loading={busy} disabled={!name.trim()}>
              Cadastrar academia aqui
            </Button>
          </>
        )}
      </form>
    </div>
  )
}
