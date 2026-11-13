/**
 * Prepara a foto do check-in: reduz para no máximo 1280px, grava um carimbo
 * com dia e hora no canto (o parceiro vê quando foi tirada) e exporta em JPEG.
 */
export async function prepareCheckinPhoto(
  source: CanvasImageSource & { width?: number; height?: number },
  sourceWidth: number,
  sourceHeight: number,
  stamp: string,
): Promise<Blob> {
  const maxSide = 1280
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight))
  const w = Math.round(sourceWidth * scale)
  const h = Math.round(sourceHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a foto')
  ctx.drawImage(source, 0, 0, w, h)

  const fontSize = Math.round(Math.max(18, w * 0.035))
  ctx.font = `600 ${fontSize}px -apple-system, system-ui, sans-serif`
  const pad = Math.round(fontSize * 0.6)
  const textWidth = ctx.measureText(stamp).width
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(pad, h - fontSize - pad * 3, textWidth + pad * 2, fontSize + pad * 2)
  ctx.fillStyle = '#d9f99d'
  ctx.textBaseline = 'middle'
  ctx.fillText(stamp, pad * 2, h - pad * 2 - fontSize / 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a foto'))), 'image/jpeg', 0.82)
  })
}

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível abrir a foto'))
    img.src = URL.createObjectURL(file)
  })
}
