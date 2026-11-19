import { describe, expect, it } from 'vitest'
import { nominatimUrl, parseNominatim } from './osmSearch'

describe('busca no OpenStreetMap', () => {
  it('converte o resultado e separa nome e endereço', () => {
    const r = parseNominatim([
      {
        lat: '-20.6499555',
        lon: '-40.4888632',
        name: 'Smart Fit',
        display_name: 'Smart Fit, Rua Bariloche, Praia do Morro, Guarapari, Espírito Santo, 29216-660, Brasil',
      },
    ])
    expect(r).toEqual([
      {
        name: 'Smart Fit',
        address: 'Rua Bariloche, Praia do Morro, Guarapari, Espírito Santo, 29216-660, Brasil',
        lat: -20.6499555,
        lng: -40.4888632,
      },
    ])
  })

  it('ignora itens sem posição válida ou sem nome', () => {
    expect(parseNominatim([{ lat: 'x', lon: '1', name: 'A' }, { lat: '95', lon: '1', name: 'B' }, { lat: '1', lon: '1' }])).toEqual([])
    expect(parseNominatim(null)).toEqual([])
    expect(parseNominatim({})).toEqual([])
  })

  it('usa a primeira parte do endereço quando não há nome', () => {
    expect(parseNominatim([{ lat: '-23.5', lon: '-46.6', display_name: 'Academia X, Rua Y, São Paulo' }])[0]).toMatchObject({
      name: 'Academia X',
      address: 'Rua Y, São Paulo',
    })
  })

  it('monta a busca no Brasil, com viés para perto de você', () => {
    const u = new URL(nominatimUrl(' smart fit ', { lat: -23.55, lng: -46.63 }))
    expect(u.searchParams.get('q')).toBe('smart fit')
    expect(u.searchParams.get('countrycodes')).toBe('br')
    expect(u.searchParams.get('viewbox')).toBe('-46.88,-23.3,-46.38,-23.8')
    expect(new URL(nominatimUrl('x')).searchParams.has('viewbox')).toBe(false)
  })
})
