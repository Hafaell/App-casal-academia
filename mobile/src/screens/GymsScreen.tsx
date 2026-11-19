import { useRef, useState } from 'react'
import { Linking, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, EmptyState, Field, Input, PageHeader, Screen, Spinner, Txt, confirmAsync, useToast } from '@/components/ui'
import GymsMap from '@/components/GymsMap'
import GymPicker from '@/components/GymPicker'
import { useAddGym, useGyms, useRemoveGym } from '@/data/queries'
import type { Gym } from '@/data/types'
import { GYM_RADIUS_M, distanceMeters, formatDistance } from '@domain/geo'
import { extractUrl, mapsSearchUrl, type SharedPlace } from '@domain/mapsLink'
import { hasGoogleMaps, searchPlaces, type PlaceResult } from '@/lib/googleMaps'
import { getPosition, locationErrorMessage, type Position } from '@/lib/location'
import { placeFromSharedText } from '@/lib/mapsLink'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

const mapsLink = (g: { lat: number; lng: number; place_id?: string | null }) =>
  g.place_id
    ? `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}&query_place_id=${encodeURIComponent(g.place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`

const openUrl = (url: string) => void Linking.openURL(url).catch(() => undefined)

export function GymsScreen() {
  const { group, nameOf, userId } = useGroup()
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
  const [mapsQuery, setMapsQuery] = useState('')
  const [shared, setShared] = useState('')
  const [reading, setReading] = useState(false)
  const [picked, setPicked] = useState<SharedPlace | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const lastShared = useRef('')

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

  async function search() {
    if (!query.trim()) return toast('Digite o nome da academia', 'error')
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

  async function addHere() {
    if (!manualName.trim()) return toast('Informe o nome da academia', 'error')
    const p = await locate()
    if (!p) return
    // Com raio de 100 m, uma academia salva com erro grande recusaria check-ins feitos dentro dela.
    if (p.accuracy > 50) {
      toast(`GPS impreciso agora (±${Math.round(p.accuracy)} m). Fique perto de uma porta ou janela, espere alguns segundos e tente de novo.`, 'error')
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

  // Abre o mapa já na sua posição (espera o GPS por até 4 s; sem GPS, abre mesmo assim).
  async function openMap() {
    if (!here) {
      setLocating(true)
      const p = await Promise.race([getPosition().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))])
      setLocating(false)
      if (p) setHere(p)
    }
    setMapOpen(true)
  }

  async function readShared(text: string) {
    setShared(text)
    lastShared.current = text
    if (!text.trim()) return
    setReading(true)
    setPicked(null)
    try {
      setPicked(await placeFromSharedText(text))
      if (!here) void getPosition().then(setHere, () => undefined)
    } catch (err) {
      fail(err)
    } finally {
      setReading(false)
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text.trim()) return toast('A área de transferência está vazia. Copie o link no Google Maps primeiro.', 'error')
      await readShared(text)
    } catch {
      toast('Não consegui colar sozinho. Toque e segure no campo e escolha Colar.', 'error')
    }
  }

  // Colar o link no campo já lê o lugar (no site isso era o evento "colar").
  // O celular não avisa "colou"; um link inteiro que aparece de uma vez é tratado como colado.
  function onSharedChange(text: string) {
    const before = lastShared.current
    setShared(text)
    lastShared.current = text
    const pasted = text.length - before.length > 10
    if (pasted && !extractUrl(before) && extractUrl(text)) void readShared(text)
  }

  function addPicked() {
    if (!picked) return
    if (!picked.name.trim()) return toast('Informe o nome da academia', 'error')
    add.mutate(
      { name: picked.name, address: picked.address || undefined, lat: picked.lat, lng: picked.lng },
      {
        onSuccess: () => {
          toast('Academia cadastrada')
          setPicked(null)
          setShared('')
          lastShared.current = ''
          setMapsQuery('')
        },
        onError: fail,
      },
    )
  }

  const mine = (gyms.data ?? []).filter((g) => g.created_by === userId)
  const others = (gyms.data ?? []).filter((g) => g.created_by !== userId)

  const away = (g: { lat: number; lng: number }) => (here ? formatDistance(distanceMeters(here, g)) : null)

  return (
    <Screen header={<PageHeader title="Academias" subtitle={group.name} back />}>
      <Txt size={14} muted>
        Cada pessoa cadastra a própria academia. No check-in o app confere pelo GPS se você está a até{' '}
        <Txt size={14} weight="700">
          {GYM_RADIUS_M} m
        </Txt>{' '}
        de uma das{' '}
        <Txt size={14} weight="700">
          suas
        </Txt>{' '}
        academias. {group.require_location ? 'Fora desse raio, o treino não é aceito.' : 'A regra está desligada em Grupo e regras.'}
      </Txt>

      <Card>
        <Txt weight="600" style={{ marginBottom: 12 }}>
          Suas academias
        </Txt>
        {gyms.isLoading ? (
          <Spinner />
        ) : !mine.length ? (
          <EmptyState>Você ainda não cadastrou a sua academia. Cadastre abaixo.</EmptyState>
        ) : (
          mine.map((g, i) => (
            <GymRow
              key={g.id}
              first={i === 0}
              gym={g}
              distance={away(g)}
              removing={remove.isPending}
              onRemove={async () => {
                if (!(await confirmAsync(`Excluir "${g.name}"? Os check-ins antigos continuam valendo.`, 'Excluir', true))) return
                remove.mutate(g.id, { onSuccess: () => toast('Academia excluída'), onError: fail })
              }}
            />
          ))
        )}
        {others.length > 0 && (
          <>
            <Txt size={14} weight="600" muted style={{ marginTop: 16, marginBottom: 4 }}>
              Do resto do grupo
            </Txt>
            <Txt size={12} muted style={{ marginBottom: 4 }}>
              Só aparecem para você saber onde cada um treina. Não valem para o seu check-in.
            </Txt>
            <View style={{ opacity: 0.8 }}>
              {others.map((g, i) => (
                <GymRow key={g.id} first={i === 0} gym={g} by={g.created_by ? nameOf(g.created_by) : undefined} distance={away(g)} />
              ))}
            </View>
          </>
        )}
        {gyms.data && gyms.data.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <GymsMap gyms={gyms.data} here={here} />
            <Txt size={12} muted style={{ marginTop: 4 }}>
              O círculo verde é onde o check-in vale ({GYM_RADIUS_M} m).
            </Txt>
          </View>
        )}
        {gyms.data && gyms.data.length > 0 && !here && (
          <Button variant="ghost" style={{ marginTop: 8 }} onPress={locate} loading={locating}>
            Ver a que distância estou
          </Button>
        )}
      </Card>

      <Card>
        <Txt weight="600">Escolher no mapa</Txt>
        <Txt size={12} muted style={{ marginTop: 4, marginBottom: 12 }}>
          Abre um mapa aqui dentro do app: toque no lugar da academia (ou arraste o pino) e cadastre. Dá para buscar pelo nome e ver o satélite.
        </Txt>
        <Button onPress={openMap} loading={locating}>
          🗺️ Abrir o mapa
        </Button>
      </Card>

      <Card>
        <Txt weight="600">Buscar no Google Maps</Txt>
        <View style={{ marginTop: 4, marginBottom: 12, gap: 2 }}>
          <Txt size={12} muted>
            1. Toque em <Txt size={12} weight="700">Abrir o Google Maps</Txt> e procure a academia pelo nome.
          </Txt>
          <Txt size={12} muted>
            2. Toque na academia e depois em <Txt size={12} weight="700">Compartilhar › Copiar link</Txt>.
          </Txt>
          <Txt size={12} muted>
            3. Volte para cá e toque em <Txt size={12} weight="700">Colar link</Txt>.
          </Txt>
        </View>
        <View style={{ gap: 8 }}>
          <Input placeholder="Nome da academia (ex.: Smart Fit Paulista)" value={mapsQuery} onChangeText={setMapsQuery} maxLength={120} />
          <Button variant="secondary" onPress={() => openUrl(mapsSearchUrl(mapsQuery))}>
            🗺️ Abrir o Google Maps
          </Button>
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Cole aqui o link do Google Maps"
              value={shared}
              onChangeText={onSharedChange}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Button onPress={() => (shared.trim() ? readShared(shared) : pasteFromClipboard())} loading={reading}>
            {shared.trim() ? 'Usar link' : 'Colar link'}
          </Button>
        </View>

        {picked && (
          <View style={{ marginTop: 16, gap: 12, borderRadius: 12, borderWidth: 1, borderColor: alpha(colors.accent, 0.4), backgroundColor: colors.surface2, padding: 12 }}>
            <Field label="Nome da academia">
              <Input value={picked.name} onChangeText={(v) => setPicked({ ...picked, name: v })} maxLength={80} />
            </Field>
            {picked.address ? (
              <Txt size={12} muted>
                {picked.address}
              </Txt>
            ) : null}
            <Txt size={12} muted>
              {away(picked) ? `📍 a ${away(picked)} de você · ` : '📍 '}
              <Txt size={12} color={colors.accent} onPress={() => openUrl(mapsLink(picked))}>
                Conferir no mapa
              </Txt>
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button variant="ghost" onPress={() => setPicked(null)}>
                Cancelar
              </Button>
              <Button style={{ flex: 1 }} onPress={addPicked} loading={add.isPending}>
                Cadastrar academia
              </Button>
            </View>
          </View>
        )}
      </Card>

      {hasGoogleMaps && (
        <Card>
          <View style={{ gap: 12 }}>
            <Txt weight="600">Buscar pelo nome aqui no app</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input placeholder="Ex.: Smart Fit Paulista" value={query} onChangeText={setQuery} maxLength={120} returnKeyType="search" onSubmitEditing={search} />
              </View>
              <Button onPress={search} loading={searching}>
                Buscar
              </Button>
            </View>
          </View>
          {results && (
            <View style={{ marginTop: 12 }}>
              {results.length === 0 && (
                <Txt size={14} muted style={{ paddingVertical: 12 }}>
                  Nada encontrado. Tente com o bairro ou a cidade.
                </Txt>
              )}
              {results.map((p, i) => (
                <View
                  key={p.placeId}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt size={14} weight="600" numberOfLines={1}>
                      {p.name}
                    </Txt>
                    <Txt size={12} muted numberOfLines={1}>
                      {p.address}
                    </Txt>
                    {away(p) && (
                      <Txt size={12} muted>
                        a {away(p)} de você
                      </Txt>
                    )}
                  </View>
                  <Button variant="secondary" onPress={() => addPlace(p)} disabled={add.isPending}>
                    Adicionar
                  </Button>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <View>
          <Txt weight="600">Estou na academia agora</Txt>
          <Txt size={12} muted>
            Faça isso de dentro da academia: o app guarda a sua posição atual como o endereço dela. É o jeito mais preciso.
          </Txt>
        </View>
        <Field label="Nome da academia">
          <Input value={manualName} onChangeText={setManualName} maxLength={80} placeholder="Ex.: Academia do bairro" />
        </Field>
        <Button onPress={addHere} loading={locating || add.isPending}>
          Usar minha localização
        </Button>
      </Card>

      {mapOpen && (
        <GymPicker
          center={here ?? gyms.data?.[0] ?? null}
          gyms={gyms.data ?? []}
          here={here}
          busy={add.isPending}
          onClose={() => setMapOpen(false)}
          onConfirm={(g) =>
            add.mutate(
              { name: g.name, address: g.address || undefined, lat: g.lat, lng: g.lng },
              {
                onSuccess: () => {
                  toast('Academia cadastrada')
                  setMapOpen(false)
                },
                onError: fail,
              },
            )
          }
        />
      )}
    </Screen>
  )
}

function GymRow({
  gym,
  by,
  distance,
  removing,
  onRemove,
  first,
}: {
  gym: Gym
  by?: string
  distance: string | null
  removing?: boolean
  /** Só aparece nas academias da própria pessoa. */
  onRemove?: () => void
  first: boolean
}) {
  const details = [by && `por ${by}`, distance && `a ${distance} de você`].filter(Boolean).join(' · ')
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <Txt size={20} accessibilityElementsHidden importantForAccessibility="no">
        📍
      </Txt>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={14} weight="600">
          {gym.name}
        </Txt>
        {gym.address ? (
          <Txt size={12} muted>
            {gym.address}
          </Txt>
        ) : null}
        {details ? (
          <Txt size={12} muted>
            {details}
          </Txt>
        ) : null}
        <Txt size={12} color={colors.accent} onPress={() => openUrl(mapsLink(gym))} accessibilityRole="link">
          Ver no mapa
        </Txt>
      </View>
      {onRemove && (
        <Button variant="danger" style={{ minHeight: 36, paddingHorizontal: 12, paddingVertical: 6 }} textStyle={{ fontSize: 12 }} onPress={onRemove} disabled={removing}>
          🗑️ Excluir
        </Button>
      )}
    </View>
  )
}
