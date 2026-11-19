import { describe, expect, it } from 'vitest'
import { extractUrl, isMapsUrl, isShortMapsUrl, mapsSearchUrl, nameFromQuery, parseMapsUrl, parseSharedText, placeFromShare } from './mapsLink'

// Endereço real para onde https://maps.app.goo.gl/MvcjDftMr7a7Pi9W6 redireciona (19/11/2026).
const PLACE_URL =
  'https://www.google.com/maps/place/Academia+Smart+Fit+-+Paulista+24/@-23.5642629,-46.6547999,15z/data=!4m7!3m6!1s0x7ab3d477e919cd5:0x78992a484d5c7cf4!8m2!3d-23.5670244!4d-46.6493965!15sChJTbWFydCBGaXQgUGF1bGlzdGEiA4gBAVoUIhJzbWFydCBmaXQgcGF1bGlzdGGSAQNneW2aASRDaGREU1VoTk1HOW5TMFZKUTBGblNVTmFNeTFZVW5WM1JSQULgAQD6AQQIABAx!16s%2Fg%2F11f4lgzdm6!18m1!1e1?entry=tts'

describe('links do Google Maps', () => {
  it('usa o pino do lugar, não o centro da tela', () => {
    expect(parseMapsUrl(PLACE_URL)).toEqual({
      name: 'Academia Smart Fit - Paulista 24',
      lat: -23.5670244,
      lng: -46.6493965,
    })
  })

  it('ignora link só com o centro da tela (@lat,lng)', () => {
    const p = parseMapsUrl('https://www.google.com/maps/search/Smart+Fit/@-23.5642629,-46.6547999,15z')
    expect(p.lat).toBeUndefined()
  })

  it('aceita coordenada explícita no q= e no ll= (Apple Maps)', () => {
    expect(parseMapsUrl('https://maps.google.com/?q=-23.55,-46.63')).toMatchObject({ lat: -23.55, lng: -46.63 })
    expect(parseMapsUrl('https://www.google.com/maps/search/?api=1&query=-23.55%2C-46.63')).toMatchObject({ lat: -23.55, lng: -46.63 })
    expect(
      parseMapsUrl('https://maps.apple.com/place?address=Av.%20Paulista%2C%20664&coordinate=-23.567,-46.649&name=Smart%20Fit'),
    ).toEqual({ name: 'Smart Fit', address: 'Av. Paulista, 664', lat: -23.567, lng: -46.649 })
  })

  it('link sem posição (q=nome&ftid=) não vira academia', () => {
    const url = 'https://www.google.com/maps?q=Academia+Smart+Fit+-+Paulista+24,+Av.+Paulista,+664&ftid=0x7ab3d477e919cd5:0x78992a484d5c7cf4'
    expect(parseMapsUrl(url)).toEqual({ name: 'Academia Smart Fit - Paulista 24' })
    expect(placeFromShare(url, url)).toBeNull()
  })

  it('recusa coordenadas fora do mapa', () => {
    expect(parseMapsUrl('https://maps.google.com/?q=95,10').lat).toBeUndefined()
    expect(parseMapsUrl('https://maps.google.com/?q=0,0').lat).toBeUndefined()
  })

  it('acha o link e o nome no texto colado', () => {
    const text = 'Academia Smart Fit - Paulista 24\nAv. Paulista, 664 - Bela Vista\nhttps://maps.app.goo.gl/MvcjDftMr7a7Pi9W6'
    expect(extractUrl(text)).toBe('https://maps.app.goo.gl/MvcjDftMr7a7Pi9W6')
    expect(extractUrl('veja (https://maps.app.goo.gl/abc).')).toBe('https://maps.app.goo.gl/abc')
    expect(extractUrl('sem link')).toBeNull()
    expect(parseSharedText(text)).toEqual({ name: 'Academia Smart Fit - Paulista 24', address: 'Av. Paulista, 664 - Bela Vista' })
    expect(placeFromShare(text, PLACE_URL)).toEqual({
      name: 'Academia Smart Fit - Paulista 24',
      address: 'Av. Paulista, 664 - Bela Vista',
      lat: -23.5670244,
      lng: -46.6493965,
    })
    expect(placeFromShare('https://maps.app.goo.gl/MvcjDftMr7a7Pi9W6', PLACE_URL)?.name).toBe('Academia Smart Fit - Paulista 24')
  })

  it('só aceita endereços de mapas', () => {
    expect(isMapsUrl('https://maps.app.goo.gl/x')).toBe(true)
    expect(isShortMapsUrl('https://maps.app.goo.gl/x')).toBe(true)
    expect(isShortMapsUrl(PLACE_URL)).toBe(false)
    expect(isMapsUrl('https://evil.com/maps/place/x')).toBe(false)
    expect(isMapsUrl('https://maps.app.goo.gl.evil.com/x')).toBe(false)
  })

  it('monta a busca pelo nome', () => {
    expect(mapsSearchUrl('Smart Fit Paulista')).toBe('https://www.google.com/maps/search/?api=1&query=Smart%20Fit%20Paulista')
    expect(mapsSearchUrl('  ')).toBe('https://www.google.com/maps/search/?api=1&query=academia')
  })
})

// Link real copiado do app do Google Maps no iPhone (19/11/2026): o redirecionamento vem sem pino.
const APP_URL =
  'https://www.google.com/maps?q=Academia+Smart+Fit+-+Guarapari+-+R.+Bariloche,+1+-+Praia+do+Morro,+Guarapari+-+ES,+29216-660&ftid=0xb8570507c38497:0x2b2174fde1082533&entry=gps&g_st=ic'

describe('link do app do Google Maps (sem pino)', () => {
  it('não acha posição só pelo link', () => {
    expect(placeFromShare('https://maps.app.goo.gl/Z9c4UbzEbioYJhQd7?g_st=ic', APP_URL)).toBeNull()
  })

  it('usa a posição achada pelo servidor e separa nome e endereço', () => {
    const address = 'R. Bariloche, 1 - Praia do Morro, Guarapari - ES, 29216-660'
    expect(nameFromQuery('Academia Smart Fit - Guarapari - ' + address, address)).toBe('Academia Smart Fit - Guarapari')
    expect(
      placeFromShare('https://maps.app.goo.gl/Z9c4UbzEbioYJhQd7?g_st=ic', APP_URL, { lat: -20.6499555, lng: -40.4888632, address }),
    ).toEqual({ name: 'Academia Smart Fit - Guarapari', address, lat: -20.6499555, lng: -40.4888632 })
  })

  it('recusa posição inválida do servidor', () => {
    expect(placeFromShare('x', APP_URL, { lat: 0, lng: 0 })).toBeNull()
    expect(placeFromShare('x', APP_URL, { lat: 99, lng: 10 })).toBeNull()
  })
})
