import { useState, type FormEvent } from 'react'
import { useGroup } from '@/app/GroupProvider'
import { Button, Card, EmptyState, Field, PageHeader, Spinner, inputClass, useToast } from '@/components/ui'
import { useAddGym, useGyms, useRemoveGym } from '@/data/queries'
import type { Gym } from '@/data/types'
import { GYM_RADIUS_M, distanceMeters, formatDistance } from '@/domain/geo'
import { hasGoogleMaps, searchPlaces, type PlaceResult } from '@/lib/googleMaps'
import { getPosition, locationErrorMessage, type Position } from '@/lib/location'
import { errorMessage } from '@/lib/supabase'

const mapsLink = (g: { lat: number; lng: number; place_id?: string | null }) =>
  g.place_id
    ? `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}&query_place_id=${encodeURIComponent(g.place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`

export function GymsPage() {
  const { group, nameOf } = useGroup()
  const gyms = useGyms(group.id)
  const add = useAddGym(group.id)
  const remove = useRemoveGym()
  const toast = useToast()

  const [here, setHere] = useState<Position | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [manualName, setManualName] = useState('')

  const fail = (err: unknown) => toast(errorMessage(err), 'error')

  async function locate(): Promise<Position | null> {
    setLocating(true)
    try {
      const p = await getPosition()
      setHere(p)
      return p
    } catch (err) {
      toast(locationErrorMessage(err), 'error')
      return null
    } finally {
      setLocating(false)
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      // A posição ajuda o Google a mostrar primeiro as unidades perto de você.
      const near = here ?? (await getPosition().then(setHereAnd, () => null))
      setResults(await searchPlaces(query.trim(), near ?? undefined))
    } catch (err) {
      fail(err)
    } finally {
      setSearching(false)
    }
  }

  function setHereAnd(p: Position) {
    setHere(p)
    return p
  }

  function addPlace(p: PlaceResult) {
    add.mutate(
      { name: p.name, address: p.address, place_id: p.placeId, lat: p.lat, lng: p.lng },
      {
        onSuccess: () => {
          toast('Academia cadastrada')
          setResults(null)
          setQuery('')
        },
        onError: fail,
      },
    )
  }

  async function addHere(e: FormEvent) {
    e.preventDefault()
    const p = await locate()
    if (!p) return
    if (p.accuracy > 100) {
      toast(`GPS impreciso agora (±${Math.round(p.accuracy)} m). Espere alguns segundos e tente de novo.`, 'error')
      return
    }
    add.mutate(
      { name: manualName, lat: p.lat, lng: p.lng },
      {
        onSuccess: () => {
          toast('Academia cadastrada na sua posição atual')
          setManualName('')
        },
        onError: fail,
      },
    )
  }

  const away = (g: { lat: number; lng: number }) => (here ? formatDistance(distanceMeters(here, g)) : null)

  return (
    <div>
      <PageHeader title="Academias" subtitle={group.name} back="/mais" />
      <div className="space-y-4 px-4 pt-4">
        <p className="text-sm text-muted">
          No check-in o app confere pelo GPS se você está a até <b className="text-ink">{GYM_RADIUS_M} m</b> de uma
          destas academias.{' '}
          {group.require_location ? 'Fora desse raio, o treino não é aceito.' : 'A regra está desligada em Grupo e regras.'}
        </p>

        <Card>
          <h2 className="mb-3 font-semibold">Cadastradas</h2>
          {gyms.isLoading ? (
            <Spinner />
          ) : !gyms.data?.length ? (
            <EmptyState>Nenhuma academia ainda. Cadastre a de vocês abaixo.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {gyms.data.map((g) => (
                <GymRow
                  key={g.id}
                  gym={g}
                  by={g.created_by ? nameOf(g.created_by) : undefined}
                  distance={away(g)}
                  removing={remove.isPending}
                  onRemove={() => {
                    if (!confirm(`Remover "${g.name}"? Os check-ins antigos continuam valendo.`)) return
                    remove.mutate(g.id, { onSuccess: () => toast('Academia removida'), onError: fail })
                  }}
                />
              ))}
            </ul>
          )}
          {gyms.data && gyms.data.length > 0 && !here && (
            <Button variant="ghost" className="mt-2 w-full" onClick={locate} loading={locating}>
              Ver a que distância estou
            </Button>
          )}
        </Card>

        {hasGoogleMaps && (
          <Card>
            <form onSubmit={search} className="space-y-3">
              <h2 className="font-semibold">Buscar no Google Maps</h2>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Ex.: Smart Fit Paulista"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  maxLength={120}
                  required
                />
                <Button type="submit" loading={searching}>
                  Buscar
                </Button>
              </div>
            </form>
            {results && (
              <ul className="mt-3 divide-y divide-line">
                {results.length === 0 && <li className="py-3 text-sm text-muted">Nada encontrado. Tente com o bairro ou a cidade.</li>}
                {results.map((p) => (
                  <li key={p.placeId} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted">{p.address}</p>
                      {away(p) && <p className="text-xs text-muted">a {away(p)} de você</p>}
                    </div>
                    <Button variant="secondary" onClick={() => addPlace(p)} disabled={add.isPending}>
                      Adicionar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card>
          <form onSubmit={addHere} className="space-y-3">
            <h2 className="font-semibold">Estou na academia agora</h2>
            <p className="-mt-2 text-xs text-muted">
              {hasGoogleMaps
                ? 'Se a busca não achar, cadastre usando a sua posição atual. Faça isso de dentro da academia.'
                : 'Faça isso de dentro da academia: o app guarda a sua posição atual como o endereço dela.'}
            </p>
            <Field label="Nome da academia">
              <input
                className={inputClass}
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                maxLength={80}
                placeholder="Ex.: Academia do bairro"
                required
              />
            </Field>
            <Button type="submit" className="w-full" loading={locating || add.isPending}>
              Usar minha localização
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

function GymRow({
  gym,
  by,
  distance,
  removing,
  onRemove,
}: {
  gym: Gym
  by?: string
  distance: string | null
  removing: boolean
  onRemove: () => void
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="text-xl" aria-hidden>
        📍
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{gym.name}</p>
        {gym.address && <p className="text-xs text-muted">{gym.address}</p>}
        <p className="text-xs text-muted">
          {[by && `por ${by}`, distance && `a ${distance} de você`].filter(Boolean).join(' · ')}
        </p>
        <a href={mapsLink(gym)} target="_blank" rel="noreferrer" className="text-xs text-accent">
          Ver no mapa
        </a>
      </div>
      <button className="text-xs text-muted" onClick={onRemove} disabled={removing}>
        Remover
      </button>
    </li>
  )
}
