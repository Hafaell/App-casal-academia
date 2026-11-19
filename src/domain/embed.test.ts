import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { embedUrl, parseEmbed } from '../../api/_embed'

// Trecho real da página "embed" do Google (19/11/2026) para a Smart Fit de Guarapari.
const html = readFileSync(new URL('./__fixtures__/embed-guarapari.txt', import.meta.url), 'utf-8')
const FTID = '0xb8570507c38497:0x2b2174fde1082533'

describe('posição pelo embed do Google', () => {
  it('acha a posição e o endereço do lugar do link', () => {
    expect(parseEmbed(html, FTID)).toEqual({
      lat: -20.6499555,
      lng: -40.4888632,
      address: 'R. Bariloche, 1 - Praia do Morro, Guarapari - ES, 29216-660',
    })
  })

  it('recusa quando o lugar devolvido não é o do link', () => {
    expect(parseEmbed(html, '0x1:0x2')).toBeNull()
    expect(parseEmbed('<html>consentimento</html>', FTID)).toBeNull()
  })

  it('monta o endereço do embed', () => {
    expect(embedUrl('a b', '0x1:0x2')).toBe('https://maps.google.com/maps?q=a+b&ftid=0x1%3A0x2&output=embed&hl=pt-BR')
  })
})
