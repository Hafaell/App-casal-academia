/**
 * Roda o desenho da foto do check-in de verdade, com o Skia "sem tela" (CanvasKit) no computador:
 * reduz a foto, desenha a faixa do carimbo e gera o JPEG. No celular o mesmo código usa o Skia nativo.
 */
jest.unmock('@/lib/image')
jest.unmock('@/lib/summaryCard')
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: jest.fn() }))

/** Motor do Skia para computador (WebAssembly), carregado antes dos testes. */
let mockCanvasKit: unknown

jest.mock('@shopify/react-native-skia', () => {
  const types = require('@shopify/react-native-skia/lib/commonjs/skia/types')
  const { JsiSkApi } = require('@shopify/react-native-skia/lib/commonjs/skia/web')
  let api: any
  // O motor só carrega no beforeAll: o Skia repassa cada uso para ele na hora.
  let fonts: any
  /**
   * No celular o texto usa as fontes do sistema. O Skia de computador não tem fontes: usa uma
   * do sistema se houver (DejaVu, comum no Linux); sem ela, o texto não aparece, mas o resto roda.
   */
  function testFonts() {
    if (fonts) return fonts
    fonts = api.TypefaceFontProvider.Make()
    try {
      const bytes = require('fs').readFileSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
      fonts.registerFont(api.Typeface.MakeFreeTypeFaceFromData(api.Data.fromBytes(new Uint8Array(bytes))), 'TesteSans')
    } catch {
      /* sem a fonte: segue sem texto */
    }
    return fonts
  }
  const ParagraphBuilder = {
    Make: (style: unknown, provider?: unknown) => {
      const builder = api.ParagraphBuilder.Make(style, provider ?? testFonts())
      const pushStyle = builder.pushStyle.bind(builder)
      builder.pushStyle = (s: any, ...rest: unknown[]) => pushStyle({ fontFamilies: ['TesteSans'], ...s }, ...rest)
      return builder
    },
  }
  const Skia = new Proxy(
    {},
    { get: (_t, prop) => ((api ??= JsiSkApi(mockCanvasKit)), prop === 'ParagraphBuilder' ? ParagraphBuilder : api[prop]) },
  )
  return { __esModule: true, ...types, Skia }
})

// Arquivo temporário em memória (no celular é o expo-file-system).
const mockFiles = new Map<string, Uint8Array>()
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri: string
    constructor(_dir: string, name: string) {
      this.uri = `file:///cache/${name}`
    }
    get exists() {
      return mockFiles.has(this.uri)
    }
    create() {
      mockFiles.set(this.uri, new Uint8Array())
    }
    delete() {
      mockFiles.delete(this.uri)
    }
    write(bytes: Uint8Array) {
      mockFiles.set(this.uri, bytes)
    }
  },
}))

import { ImageFormat, Skia } from '@shopify/react-native-skia'
import { prepareCheckinPhoto } from '@/lib/image'
import { buildSummaryCard } from '@/lib/summaryCard'

beforeAll(async () => {
  const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit')
  mockCanvasKit = await CanvasKitInit({
    locateFile: (file: string) => require.resolve(`canvaskit-wasm/bin/full/${file}`),
  })
})

/** Uma "foto da câmera" de 1920x1440, toda azul, em JPEG (base64). */
function cameraPhoto(): string {
  const surface = Skia.Surface.MakeOffscreen(1920, 1440)!
  surface.getCanvas().drawColor(Skia.Color('#3366cc'))
  surface.flush()
  return surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 90)
}

function pixel(img: ReturnType<typeof Skia.Image.MakeImageFromEncoded>, x: number, y: number) {
  const data = img!.readPixels(x, y, { width: 1, height: 1, colorType: 4, alphaType: 1 }) as Uint8Array
  return Array.from(data.slice(0, 3))
}

it('reduz para 1280 px, desenha o carimbo e gera um JPEG', () => {
  const out = prepareCheckinPhoto(cameraPhoto(), 'qua 18/11 · 12:00 · Smart Fit Centro')

  // JPEG começa com FF D8 FF.
  expect(Array.from(out.bytes.slice(0, 3))).toEqual([0xff, 0xd8, 0xff])
  expect(mockFiles.get(out.uri)).toBe(out.bytes)

  // Para ver a imagem: FOTO_TESTE=/caminho/foto.jpg npx jest image
  if (process.env.FOTO_TESTE) require('fs').writeFileSync(process.env.FOTO_TESTE, out.bytes)

  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(out.bytes))!
  expect(img.width()).toBe(1280)
  expect(img.height()).toBe(960)

  // Longe do carimbo a foto continua azul; dentro da faixa do carimbo fica escura.
  const [r, g, b] = pixel(img, 1200, 100)
  expect(b).toBeGreaterThan(150)
  expect(r).toBeLessThan(90)
  expect(g).toBeLessThan(140)
  const fontSize = Math.round(Math.max(18, 1280 * 0.035))
  const pad = Math.round(fontSize * 0.6)
  const inside = pixel(img, pad + 4, 960 - pad * 2) // canto da faixa, antes do texto
  expect(inside[2]).toBeLessThan(b * 0.6)
})

it('monta o cartão da semana com as fotos e o placar', async () => {
  const photo = Uint8Array.from(Buffer.from(cameraPhoto(), 'base64'))
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
    async () => ({ ok: true, arrayBuffer: async () => photo.buffer.slice(0) }) as unknown as Response,
  )
  const card = await buildSummaryCard({
    title: 'Treino a Dois',
    subtitle: 'Semana 09/11 a 15/11',
    photos: ['https://fotos.test/1.jpg', 'https://fotos.test/2.jpg', 'https://fotos.test/3.jpg', 'https://fotos.test/4.jpg'],
    lines: [
      { name: 'Rafael', color: '#c6f432', text: '4/4 ✓' },
      { name: 'Ana', color: '#38bdf8', text: '2/4' },
    ],
    footer: 'Caixinha: R$ 30',
  })
  fetchMock.mockRestore()
  const bytes = mockFiles.get(card.uri)!
  if (process.env.CARTAO_TESTE) require('fs').writeFileSync(process.env.CARTAO_TESTE, bytes)
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes))!
  expect([img.width(), img.height()]).toEqual([1080, 1350])
  // Primeira foto da grade (azul) no lugar certo; fundo escuro fora dela.
  expect(pixel(img, 64 + 50, 224 + 50)[2]).toBeGreaterThan(150)
  expect(pixel(img, 20, 20)[2]).toBeLessThan(40)
})

it('monta a colagem do ano com 12 fotos quadradas e o texto cabe embaixo', async () => {
  const photo = Uint8Array.from(Buffer.from(cameraPhoto(), 'base64'))
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
    async () => ({ ok: true, arrayBuffer: async () => photo.buffer.slice(0) }) as unknown as Response,
  )
  const card = await buildSummaryCard({
    title: 'Nosso 2026',
    subtitle: 'Rafael e Ana',
    columns: 4,
    photos: Array.from({ length: 14 }, (_, i) => `https://fotos.test/${i}.jpg`),
    lines: [
      { name: 'Treinos', color: '#c6f432', text: '180' },
      { name: 'Juntos', color: '#f472b6', text: '42' },
      { name: 'Semanas batidas', color: '#38bdf8', text: '40' },
    ],
    footer: 'Treino a Dois',
  })
  // Só 12 fotos entram.
  expect(fetchMock).toHaveBeenCalledTimes(12)
  fetchMock.mockRestore()
  const bytes = mockFiles.get(card.uri)!
  if (process.env.COLAGEM_TESTE) require('fs').writeFileSync(process.env.COLAGEM_TESTE, bytes)
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes))!
  expect([img.width(), img.height()]).toEqual([1080, 1350])
  const cell = (1080 - 128 - 16 * 3) / 4
  // Última foto (4ª coluna, 3ª linha) azul; a faixa logo abaixo da grade é fundo escuro.
  expect(pixel(img, Math.round(64 + 3 * (cell + 16) + cell / 2), Math.round(224 + 2 * (cell + 16) + cell / 2))[2]).toBeGreaterThan(150)
  expect(pixel(img, 540, Math.round(224 + 3 * cell + 2 * 16 + 8))[2]).toBeLessThan(40)
})

it('monta o story (1080x1920) com o número em destaque e as fotos abaixo dele', async () => {
  const photo = Uint8Array.from(Buffer.from(cameraPhoto(), 'base64'))
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
    async () => ({ ok: true, arrayBuffer: async () => photo.buffer.slice(0) }) as unknown as Response,
  )
  const card = await buildSummaryCard({
    format: 'story',
    title: 'Treino a Dois',
    subtitle: 'Rafael e Ana',
    highlight: { value: '12', label: 'treinos juntos em novembro' },
    photos: Array.from({ length: 6 }, (_, i) => `https://fotos.test/${i}.jpg`),
    lines: [
      { name: 'Sequência do casal', color: '#c6f432', text: '🔥 3' },
      { name: 'Juntos em 2026', color: '#f472b6', text: '40' },
    ],
    footer: 'Treino a Dois',
  })
  fetchMock.mockRestore()
  const bytes = mockFiles.get(card.uri)!
  if (process.env.STORY_TESTE) require('fs').writeFileSync(process.env.STORY_TESTE, bytes)
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes))!
  expect([img.width(), img.height()]).toEqual([1080, 1920])
  // A grade começa depois do título (desce 200 px) e do destaque (300 px): y = 724.
  expect(pixel(img, 64 + 50, 724 - 20)[2]).toBeLessThan(40)
  expect(pixel(img, 64 + 50, 724 + 50)[2]).toBeGreaterThan(150)
  const cellH = ((1080 - 128 - 32) / 3) * 1.25
  // Fim da segunda linha de fotos, antes do texto.
  expect(pixel(img, 540, Math.round(724 + 2 * cellH + 16 + 8))[2]).toBeLessThan(40)
})
