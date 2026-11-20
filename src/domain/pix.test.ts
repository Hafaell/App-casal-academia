import { describe, expect, it } from 'vitest'
import { crc16, isValidCpf, normalizePixKey, pixPayload, pixText } from './pix'

describe('Pix copia e cola', () => {
  it('calcula o CRC16-CCITT padrão', () => {
    // Valor de conferência clássico do CRC-16/CCITT-FALSE.
    expect(crc16('123456789')).toBe('29B1')
  })

  it('gera o mesmo código do exemplo do manual do Banco Central', () => {
    const code = pixPayload({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' })
    expect(code).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    )
  })

  it('inclui o valor com centavos e tira acentos de nome e cidade', () => {
    const code = pixPayload({ key: 'rafa@exemplo.com', name: 'Rafaél Conceição', city: 'São Mateus', amount: 30 })
    expect(code).toContain('540530.00')
    expect(code).toContain('5916Rafael Conceicao')
    expect(code).toContain('6010Sao Mateus')
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)))
  })

  it('corta nome e cidade no tamanho do Pix', () => {
    expect(pixText('Maria Aparecida dos Santos Oliveira', 25)).toBe('Maria Aparecida dos Santo')
    expect(pixText('  Cachoeiro   de Itapemirim ', 15)).toBe('Cachoeiro de It')
  })

  it('arruma a chave como o banco espera', () => {
    expect(normalizePixKey('(27) 99999-1234')).toBe('+5527999991234')
    expect(normalizePixKey('+55 27 99999-1234')).toBe('+5527999991234')
    expect(normalizePixKey('123.456.789-09')).toBe('12345678909')
    expect(normalizePixKey('12345678909')).toBe('12345678909') // CPF válido, sem pontos
    expect(normalizePixKey('27999991234')).toBe('+5527999991234') // celular sem formatação
    expect(normalizePixKey('11.222.333/0001-81')).toBe('11222333000181')
    expect(normalizePixKey('123e4567-e12b-12d1-a456-426655440000')).toBe('123e4567-e12b-12d1-a456-426655440000')
    expect(normalizePixKey(' Rafa@Exemplo.com ')).toBe('rafa@exemplo.com')
  })

  it('confere o CPF', () => {
    expect(isValidCpf('12345678909')).toBe(true)
    expect(isValidCpf('27999991234')).toBe(false)
    expect(isValidCpf('11111111111')).toBe(false)
  })

  it('recusa sem chave, nome ou cidade', () => {
    expect(() => pixPayload({ key: ' ', name: 'A', city: 'B' })).toThrow('chave')
    expect(() => pixPayload({ key: 'x@y.com', name: '', city: 'B' })).toThrow('nome')
    expect(() => pixPayload({ key: 'x@y.com', name: 'A', city: '' })).toThrow('cidade')
  })
})
