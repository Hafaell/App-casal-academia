/**
 * Cartão do resumo da semana: uma imagem com o placar e as fotos, para a pessoa compartilhar.
 * É desenhado no aparelho (canvas). As fotos são privadas: o cartão só sai do app se a pessoa
 * tocar em compartilhar.
 */

export interface SummaryLine {
  name: string
  color: string
  text: string
}

export interface SummaryCardData {
  title: string
  subtitle: string
  lines: SummaryLine[]
  /** Endereços (assinados) das fotos da semana; usa até 6. */
  photos: string[]
  footer: string
}

const W = 1080
const H = 1350 // 4:5, o formato do feed do Instagram; também cabe na memória do iPhone.

function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // sem isso o canvas fica "contaminado" e não exporta
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function buildSummaryCard(d: SummaryCardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não consegui montar a imagem neste aparelho.')

  ctx.fillStyle = '#0b0f14'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#eef2f6'
  ctx.font = '700 64px system-ui, -apple-system, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(d.title, 64, 120)
  ctx.fillStyle = '#8b97a8'
  ctx.font = '400 38px system-ui, -apple-system, sans-serif'
  ctx.fillText(d.subtitle, 64, 176)

  // Fotos: grade de 3 colunas, até 2 linhas.
  const photos = (await Promise.all(d.photos.slice(0, 6).map(loadPhoto))).filter((p): p is HTMLImageElement => p !== null)
  const gap = 16
  const cellW = (W - 128 - gap * 2) / 3
  const cellH = cellW * 1.25
  const top = 224
  photos.forEach((img, i) => {
    const x = 64 + (i % 3) * (cellW + gap)
    const y = top + Math.floor(i / 3) * (cellH + gap)
    ctx.save()
    roundRect(ctx, x, y, cellW, cellH, 24)
    ctx.clip()
    cover(ctx, img, x, y, cellW, cellH)
    ctx.restore()
  })
  const rows = photos.length === 0 ? 0 : photos.length > 3 ? 2 : 1
  let y = top + rows * (cellH + gap) + (rows ? 40 : 0)

  // Placar de cada pessoa.
  for (const line of d.lines) {
    ctx.fillStyle = line.color
    ctx.beginPath()
    ctx.arc(84, y - 14, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#eef2f6'
    ctx.font = '600 44px system-ui, -apple-system, sans-serif'
    ctx.fillText(line.name, 120, y)
    ctx.fillStyle = '#c6f432'
    ctx.font = '700 44px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(line.text, W - 64, y)
    ctx.textAlign = 'left'
    y += 72
  }

  ctx.fillStyle = '#8b97a8'
  ctx.font = '400 34px system-ui, -apple-system, sans-serif'
  ctx.fillText(d.footer, 64, H - 64)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não consegui gerar a imagem.'))), 'image/jpeg', 0.9),
  )
}

/** Abre o compartilhamento do aparelho; se não existir, baixa o arquivo. */
export async function shareImage(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') throw err // fechar a janela não é erro
    }
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
