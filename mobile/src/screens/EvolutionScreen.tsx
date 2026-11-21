/**
 * Fotos de evolução: área privada. Cada foto só aparece para quem tirou, a não ser que a pessoa
 * escolha mostrar ao parceiro (foto por foto). Nunca vai para o feed.
 */
import { useEffect, useState } from 'react'
import { Image, Pressable, Switch, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useGroup } from '@/providers/GroupProvider'
import { Button, Card, EmptyState, Field, Input, PageHeader, PhotoViewer, Screen, Sheet, Spinner, Txt, confirmAsync, useToast } from '@/components/ui'
import { useAddEvolutionPhoto, useDeleteEvolutionPhoto, useEvolutionPhotos, useEvolutionUrls, useUpdateEvolutionPhoto } from '@/data/queries'
import type { EvolutionPhoto } from '@/data/types'
import { formatBrDate, parseBrDate } from '@domain/dates'
import { prepareCheckinPhoto } from '@/lib/image'
import { readLocal, writeLocal } from '@/lib/storage'
import { errorMessage } from '@/lib/supabase'
import { alpha, colors } from '@/lib/theme'

const CONSENT_KEY = 'treino:evolucao-aceite'

const kg = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`

export function EvolutionScreen() {
  const { group, userId, nameOf } = useGroup()
  const photos = useEvolutionPhotos(group.id)
  const urls = useEvolutionUrls((photos.data ?? []).map((p) => p.photo_path))
  const [consent, setConsent] = useState<boolean | null>(null)
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState<EvolutionPhoto | null>(null)

  useEffect(() => {
    readLocal(CONSENT_KEY).then((v) => setConsent(v === '1'))
  }, [])

  if (photos.isError) {
    return (
      <Screen header={<PageHeader title="Fotos de evolução" back />}>
        <EmptyState>As fotos de evolução ficam disponíveis depois que a atualização do banco for aplicada no Supabase.</EmptyState>
      </Screen>
    )
  }

  const mine = (photos.data ?? []).filter((p) => p.user_id === userId)
  const shared = (photos.data ?? []).filter((p) => p.user_id !== userId)
  const first = mine[0]
  const last = mine.length > 1 ? mine[mine.length - 1] : undefined

  return (
    <Screen header={<PageHeader title="Fotos de evolução" subtitle="Privadas: só você vê, a não ser que escolha mostrar" back />}>
      {consent === false ? (
        <Card style={{ borderColor: alpha(colors.accent, 0.4), gap: 8 }}>
          <Txt weight="700">🔒 Como funcionam as fotos de evolução</Txt>
          <Txt size={14}>• Cada foto fica guardada só para você. Nem o seu parceiro vê.</Txt>
          <Txt size={14}>• Se quiser, você escolhe mostrar uma foto ao parceiro, uma por uma, e pode parar de mostrar quando quiser.</Txt>
          <Txt size={14}>• Elas nunca aparecem no feed nem nas imagens para compartilhar.</Txt>
          <Txt size={14}>• Apagou a foto, ela some do app e do armazenamento.</Txt>
          <Button
            style={{ marginTop: 4 }}
            onPress={() => {
              void writeLocal(CONSENT_KEY, '1')
              setConsent(true)
            }}
          >
            Entendi, quero usar
          </Button>
        </Card>
      ) : consent === null || photos.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Button onPress={() => setAdding(true)}>📷 Adicionar foto</Button>

          {first && last && (
            <Card>
              <Txt weight="700">Antes e depois</Txt>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {[first, last].map((p) => (
                  <Pressable key={p.id} style={{ flex: 1 }} onPress={() => setViewing(p)} accessibilityLabel={`Foto de ${formatBrDate(p.taken_on)}`}>
                    <View style={{ aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface2 }}>
                      {urls.data?.get(p.photo_path) ? (
                        <Image source={{ uri: urls.data.get(p.photo_path) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : null}
                    </View>
                    <Txt size={12} center style={{ marginTop: 4 }}>
                      {formatBrDate(p.taken_on)}
                      {p.weight_kg != null ? ` · ${kg(p.weight_kg)}` : ''}
                    </Txt>
                  </Pressable>
                ))}
              </View>
              {first.weight_kg != null && last.weight_kg != null && (
                <Txt size={14} weight="600" center style={{ marginTop: 8 }}>
                  {last.weight_kg === first.weight_kg
                    ? 'Mesmo peso'
                    : `${last.weight_kg < first.weight_kg ? '−' : '+'}${kg(Math.abs(last.weight_kg - first.weight_kg))} no período`}
                </Txt>
              )}
            </Card>
          )}

          <PhotoGrid title="Suas fotos" photos={[...mine].reverse()} urls={urls.data} onOpen={setViewing} empty="Nenhuma foto ainda. A primeira vira o seu “antes”." />
          {shared.length > 0 && (
            <PhotoGrid
              title={`Mostradas por ${[...new Set(shared.map((p) => nameOf(p.user_id).split(' ')[0]))].join(' e ')}`}
              photos={[...shared].reverse()}
              urls={urls.data}
              onOpen={setViewing}
            />
          )}
        </>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)}>
        {adding && <AddPhotoForm onDone={() => setAdding(false)} />}
      </Sheet>
      <PhotoViewer
        url={viewing ? (urls.data?.get(viewing.photo_path) ?? null) : null}
        caption={viewing ? <PhotoActions photo={viewing} onDone={() => setViewing(null)} /> : undefined}
        onClose={() => setViewing(null)}
      />
    </Screen>
  )
}

function PhotoGrid({
  title,
  photos,
  urls,
  onOpen,
  empty,
}: {
  title: string
  photos: EvolutionPhoto[]
  urls?: Map<string, string>
  onOpen: (p: EvolutionPhoto) => void
  empty?: string
}) {
  return (
    <View style={{ gap: 8 }}>
      <Txt size={14} weight="600" muted>
        {title}
      </Txt>
      {photos.length === 0 && empty ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {photos.map((p) => (
            <Pressable key={p.id} onPress={() => onOpen(p)} style={{ width: '31%' }} accessibilityLabel={`Foto de ${formatBrDate(p.taken_on)}`}>
              <View style={{ aspectRatio: 3 / 4, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface2 }}>
                {urls?.get(p.photo_path) ? <Image source={{ uri: urls.get(p.photo_path) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
              </View>
              <Txt size={10} muted center>
                {formatBrDate(p.taken_on)}
                {p.shared ? ' · 👀' : ''}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

/** Ações da foto aberta: mostrar ou esconder do parceiro e apagar (só para quem tirou). */
function PhotoActions({ photo, onDone }: { photo: EvolutionPhoto; onDone: () => void }) {
  const { userId, nameOf } = useGroup()
  const update = useUpdateEvolutionPhoto()
  const remove = useDeleteEvolutionPhoto()
  const toast = useToast()
  const mine = photo.user_id === userId
  const label = `${formatBrDate(photo.taken_on)}${photo.weight_kg != null ? ` · ${kg(photo.weight_kg)}` : ''}${photo.note ? ` · ${photo.note}` : ''}`

  if (!mine) return <Txt size={14}>{`${nameOf(photo.user_id)} · ${label}`}</Txt>

  async function del() {
    if (!(await confirmAsync('Apagar esta foto? Ela some do app e do armazenamento.', 'Apagar', true))) return
    remove.mutate(photo, { onSuccess: onDone, onError: (err) => toast(errorMessage(err), 'error') })
  }

  return (
    <View style={{ gap: 8 }}>
      <Txt size={14} center>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() =>
            update.mutate(
              { id: photo.id, shared: !photo.shared },
              { onSuccess: () => { toast(photo.shared ? 'Agora só você vê esta foto' : 'O parceiro agora vê esta foto'); onDone() }, onError: (err) => toast(errorMessage(err), 'error') },
            )
          }
        >
          {photo.shared ? '🔒 Parar de mostrar' : '👀 Mostrar ao parceiro'}
        </Button>
        <Button variant="danger" onPress={del}>
          Apagar
        </Button>
      </View>
    </View>
  )
}

function AddPhotoForm({ onDone }: { onDone: () => void }) {
  const { group, userId, today } = useGroup()
  const add = useAddEvolutionPhoto(group.id, userId)
  const toast = useToast()
  const [picked, setPicked] = useState<{ base64: string; uri: string } | null>(null)
  const [date, setDate] = useState(formatBrDate(today))
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [shared, setShared] = useState(false)

  async function pick(fromCamera: boolean) {
    try {
      const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) return toast(fromCamera ? 'Permita o uso da câmera nos Ajustes' : 'Permita o acesso às fotos nos Ajustes', 'error')
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.9 }
      const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts)
      if (res.canceled || !res.assets[0]?.base64) return
      setPicked({ base64: res.assets[0].base64, uri: res.assets[0].uri })
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  function save() {
    if (!picked) return
    const day = parseBrDate(date)
    if (!day) return toast('Data inválida. Use DD/MM/AAAA', 'error')
    if (day > today) return toast('A data não pode ser no futuro', 'error')
    const w = weight.trim() ? Number(weight.replace(',', '.')) : null
    if (w !== null && (!Number.isFinite(w) || w < 20 || w > 400)) return toast('Peso inválido', 'error')
    try {
      const stamp = `${formatBrDate(day)}${w !== null ? ` · ${kg(w)}` : ''}`
      const prepared = prepareCheckinPhoto(picked.base64, stamp)
      add.mutate(
        { photo: prepared.bytes, takenOn: day, weightKg: w, note, shared },
        {
          onSuccess: () => {
            toast('Foto guardada')
            onDone()
          },
          onError: (err) => toast(errorMessage(err), 'error'),
        },
      )
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Txt size={18} weight="600">
        Nova foto de evolução
      </Txt>
      {picked ? (
        <Image source={{ uri: picked.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} resizeMode="cover" />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} onPress={() => pick(true)}>
            📷 Tirar agora
          </Button>
          <Button variant="secondary" style={{ flex: 1 }} onPress={() => pick(false)}>
            🖼️ Da galeria
          </Button>
        </View>
      )}
      <Field label="Data da foto (DD/MM/AAAA)">
        <Input value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" maxLength={10} />
      </Field>
      <Field label="Peso em kg (opcional)">
        <Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Ex.: 72,5" maxLength={6} />
      </Field>
      <Field label="Observação (opcional)">
        <Input value={note} onChangeText={setNote} maxLength={200} />
      </Field>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Switch value={shared} onValueChange={setShared} accessibilityLabel="Mostrar ao parceiro" />
        <Txt size={14} style={{ flex: 1 }}>
          Mostrar ao parceiro (desligado: só você vê)
        </Txt>
      </View>
      <Button onPress={save} disabled={!picked} loading={add.isPending}>
        Guardar foto
      </Button>
    </View>
  )
}
