/**
 * Prepara a foto do check-in: reduz para no máximo 1280px, grava um carimbo
 * com dia e hora no canto (o parceiro vê quando foi tirada) e exporta em JPEG.
 * Mesmo desenho do site (src/lib/image.ts), feito com o Skia no lugar do canvas.
 */
import { File, Paths } from 'expo-file-system'
import { FontWeight, ImageFormat, Skia, type SkCanvas } from '@shopify/react-native-skia'

export interface PreparedPhoto {
  /** JPEG pronto para enviar. */
  bytes: Uint8Array
  /** Arquivo temporário no aparelho, para a prévia na tela. */
  uri: string
}

/** Escreve um texto com o sistema de fontes do aparelho (inclui emoji). Devolve largura e altura. */
export function textBlock(
  text: string,
  opts: { fontSize: number; color: string; weight?: FontWeight; maxWidth?: number },
): { width: number; height: number; paint: (canvas: SkCanvas, x: number, y: number) => void } {
  const builder = Skia.ParagraphBuilder.Make({ maxLines: 1, ellipsis: '…' })
  builder.pushStyle({
    color: Skia.Color(opts.color),
    fontSize: opts.fontSize,
    fontStyle: { weight: opts.weight ?? FontWeight.Normal },
  })
  builder.addText(text)
  const paragraph = builder.build()
  paragraph.layout(opts.maxWidth ?? 100_000)
  return {
    width: Math.ceil(paragraph.getLongestLine()),
    height: paragraph.getHeight(),
    paint: (canvas, x, y) => paragraph.paint(canvas, x, y),
  }
}

/** Grava os bytes num arquivo temporário e devolve o endereço dele. */
export function writeTempFile(bytes: Uint8Array, name: string): string {
  const file = new File(Paths.cache, name)
  if (file.exists) file.delete()
  file.create()
  file.write(bytes)
  return file.uri
}

export function prepareCheckinPhoto(base64Jpeg: string, stamp: string): PreparedPhoto {
  const source = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64Jpeg))
  if (!source) throw new Error('Não foi possível processar a foto')
  const sourceWidth = source.width()
  const sourceHeight = source.height()

  const maxSide = 1280
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight))
  const w = Math.round(sourceWidth * scale)
  const h = Math.round(sourceHeight * scale)

  const surface = Skia.Surface.MakeOffscreen(w, h)
  if (!surface) throw new Error('Não foi possível processar a foto')
  const canvas = surface.getCanvas()
  canvas.drawImageRect(source, Skia.XYWHRect(0, 0, sourceWidth, sourceHeight), Skia.XYWHRect(0, 0, w, h), Skia.Paint())

  const fontSize = Math.round(Math.max(18, w * 0.035))
  const pad = Math.round(fontSize * 0.6)
  const text = textBlock(stamp, { fontSize, color: '#d9f99d', weight: FontWeight.SemiBold, maxWidth: w - pad * 4 })
  const box = Skia.Paint()
  box.setColor(Skia.Color('rgba(0, 0, 0, 0.55)'))
  canvas.drawRect(Skia.XYWHRect(pad, h - fontSize - pad * 3, text.width + pad * 2, fontSize + pad * 2), box)
  // O site alinha o texto pelo meio da faixa; aqui o Skia desenha a partir do topo do parágrafo.
  text.paint(canvas, pad * 2, h - pad * 2 - fontSize / 2 - text.height / 2)

  surface.flush()
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 82)
  if (!bytes || bytes.length === 0) throw new Error('Falha ao gerar a foto')
  const uri = writeTempFile(bytes, `checkin-${Date.now()}.jpg`)
  return { bytes, uri }
}
