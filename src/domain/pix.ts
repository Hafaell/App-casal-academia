/**
 * "Pix copia e cola" (BR Code estático do Banco Central).
 * O app só monta o texto com a chave de quem guarda a caixinha: o dinheiro nunca passa por ele.
 */

export interface PixInput {
  /** Chave Pix de quem recebe (e-mail, celular, CPF ou chave aleatória). */
  key: string
  /** Nome de quem recebe (até 25 letras). */
  name: string
  /** Cidade de quem recebe (até 15 letras). */
  city: string
  /** Valor em reais. Sem valor, quem paga digita no banco. */
  amount?: number
  /** Texto curto que aparece para quem paga (opcional). */
  message?: string
}

/** Tira acentos e caracteres fora do padrão do Pix, e corta no tamanho máximo. */
export function pixText(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,@*\-/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Confere os dois dígitos verificadores do CPF. */
export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false
  const check = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10])
}

/** Chave de celular vira +55DDDNÚMERO; CPF e CNPJ ficam só com números; as outras sem espaços. */
export function normalizePixKey(key: string): string {
  const k = key.trim()
  if (k.includes('@')) return k.toLowerCase()
  const digits = k.replace(/\D/g, '')
  if (/^[\d.\-/ ()+]+$/.test(k)) {
    if (/^\+?55/.test(k) && digits.length === 13) return `+${digits}`
    // 11 dígitos: CPF se os dígitos verificadores batem, senão celular com DDD.
    if (digits.length === 11) return isValidCpf(digits) && !/[()+]/.test(k) ? digits : `+55${digits}`
    if (digits.length === 14) return digits // CNPJ
  }
  return k.replace(/\s/g, '')
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do código. */
export function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function pixPayload(p: PixInput): string {
  const key = normalizePixKey(p.key)
  if (!key) throw new Error('Informe a chave Pix')
  const name = pixText(p.name, 25)
  const city = pixText(p.city, 15)
  if (!name) throw new Error('Informe o nome de quem recebe')
  if (!city) throw new Error('Informe a cidade de quem recebe')
  const message = p.message ? pixText(p.message, 40) : ''

  const account = field('00', 'br.gov.bcb.pix') + field('01', key) + (message ? field('02', message) : '')
  if (account.length > 99) throw new Error('A chave Pix e a mensagem estão longas demais')

  let payload =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (p.amount && p.amount > 0 ? field('54', p.amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', name) +
    field('60', city) +
    field('62', field('05', '***'))
  payload += '6304'
  return payload + crc16(payload)
}
