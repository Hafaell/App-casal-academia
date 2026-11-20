/**
 * Cartão do resumo da semana: uma imagem com o placar e as fotos, para a pessoa compartilhar.
 * É desenhado no aparelho (Skia, no lugar do canvas do site). As fotos são privadas: o cartão
 * só sai do app se a pessoa tocar em compartilhar.
 */
import * as Sharing from 'expo-sharing'
import { ClipOp, FontWeight, ImageFormat, Skia, type SkCanvas, type SkImage } from '@shopify/react-native-skia'
import { snapshot, textBlock, writeTempFile } from './image'

export interface SummaryLine {
  name: string
  color: string
  text: string
}

export interface SummaryCardData {
  title: string
  subtitle: string
  lines: SummaryLine[]
  /** Endereços (assinados) das fotos; usa até 6 (3 colunas) ou 12 (4 colunas). */
  photos: string[]
  footer: string
  /** 3 colunas de fotos em pé (semana, mês) ou 4 de fotos quadradas (colagem do ano). */
  columns?: 3 | 4
}

const W = 1080
const H = 1350 // 4:5, o formato do feed do Instagram.

async function loadPhoto(url: string): Promise<SkImage | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes))
  } catch {
    return null
  }
}

function cover(canvas: SkCanvas, img: SkImage, x: number, y: number, w: number, h: number) {
  const iw = img.width()
  const ih = img.height()
  const scale = Math.max(w / iw, h / ih)
  const sw = w / scale
  const sh = h / scale
  canvas.drawImageRect(img, Skia.XYWHRect((iw - sw) / 2, (ih - sh) / 2, sw, sh), Skia.XYWHRect(x, y, w, h), Skia.Paint())
}

/** Texto alinhado à direita, terminando em `right`. */
function rightText(canvas: SkCanvas, text: string, right: number, baseline: number, fontSize: number, color: string, weight: FontWeight) {
  const t = textBlock(text, { fontSize, color, weight })
  t.paint(canvas, right - t.width, baseline - fontSize)
}

export interface SummaryCard {
  /** Arquivo JPEG no aparelho. */
  uri: string
}

export async function buildSummaryCard(d: SummaryCardData): Promise<SummaryCard> {
  const surface = Skia.Surface.MakeOffscreen(W, H)
  if (!surface) throw new Error('Não consegui montar a imagem neste aparelho.')
  const canvas = surface.getCanvas()
  canvas.drawColor(Skia.Color('#0b0f14'))

  // Os textos são desenhados a partir do topo; o site usava a linha de base (y menos o tamanho da letra).
  textBlock(d.title, { fontSize: 64, color: '#eef2f6', weight: FontWeight.Bold }).paint(canvas, 64, 120 - 64)
  textBlock(d.subtitle, { fontSize: 38, color: '#8b97a8' }).paint(canvas, 64, 176 - 38)

  // Fotos: 3 colunas em pé (até 2 linhas) ou 4 colunas quadradas (até 3 linhas).
  const cols = d.columns ?? 3
  const photos = (await Promise.all(d.photos.slice(0, cols * (cols === 4 ? 3 : 2)).map(loadPhoto))).filter((p): p is SkImage => p !== null)
  const gap = 16
  const cellW = (W - 128 - gap * (cols - 1)) / cols
  const cellH = cols === 4 ? cellW : cellW * 1.25
  const top = 224
  photos.forEach((img, i) => {
    const x = 64 + (i % cols) * (cellW + gap)
    const y = top + Math.floor(i / cols) * (cellH + gap)
    canvas.save()
    canvas.clipRRect(Skia.RRectXY(Skia.XYWHRect(x, y, cellW, cellH), 24, 24), ClipOp.Intersect, true)
    cover(canvas, img, x, y, cellW, cellH)
    canvas.restore()
  })
  const rows = Math.ceil(photos.length / cols)
  let y = top + rows * (cellH + gap) + (rows ? 40 : 0)

  // Placar de cada pessoa.
  for (const line of d.lines) {
    const dot = Skia.Paint()
    dot.setColor(Skia.Color(line.color))
    canvas.drawCircle(84, y - 14, 14, dot)
    textBlock(line.name, { fontSize: 44, color: '#eef2f6', weight: FontWeight.SemiBold, maxWidth: W - 400 }).paint(canvas, 120, y - 44)
    rightText(canvas, line.text, W - 64, y, 44, '#c6f432', FontWeight.Bold)
    y += 72
  }

  textBlock(d.footer, { fontSize: 34, color: '#8b97a8' }).paint(canvas, 64, H - 64 - 34)

  surface.flush()
  const bytes = snapshot(surface).encodeToBytes(ImageFormat.JPEG, 90)
  if (!bytes || bytes.length === 0) throw new Error('Não consegui gerar a imagem.')
  return { uri: writeTempFile(bytes, `semana-${Date.now()}.jpg`) }
}

/**
 * Abre o compartilhamento do aparelho. Devolve false quando não deu (aparelho sem suporte):
 * quem chamou mostra a imagem para a pessoa ver.
 */
export async function shareImage(card: SummaryCard, dialogTitle = 'Compartilhar a semana'): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false
  await Sharing.shareAsync(card.uri, { mimeType: 'image/jpeg', dialogTitle, UTI: 'public.jpeg' })
  return true
}
