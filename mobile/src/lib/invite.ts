import * as Linking from 'expo-linking'

/**
 * Código de convite vindo de um link (treinoadois://?convite=ABC123), guardado até a pessoa
 * entrar na conta. No site isso ficava no sessionStorage; aqui fica na memória do app aberto.
 */
let pending = ''

export function capturePendingInvite(url: string | null | undefined) {
  if (!url) return
  try {
    const code = Linking.parse(url).queryParams?.convite
    if (typeof code === 'string' && code) pending = code.toUpperCase()
  } catch {
    /* link inválido: ignora */
  }
}

export function pendingInvite(): string {
  return pending
}

export function clearPendingInvite() {
  pending = ''
}

/** Link do convite: abre o site publicado (quem tem o app usa o código). */
export function inviteLink(code: string): string {
  const site = process.env.EXPO_PUBLIC_SITE_URL || 'https://treino-a-dois-theta.vercel.app'
  return `${site.replace(/\/$/, '')}/?convite=${code}`
}
