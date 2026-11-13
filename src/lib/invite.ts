const KEY = 'treino:convite'

/** Guarda o código do link de convite (?convite=ABC123) até a pessoa fazer login. */
export function capturePendingInvite() {
  const code = new URLSearchParams(window.location.search).get('convite')
  if (!code) return
  try {
    sessionStorage.setItem(KEY, code.toUpperCase())
  } catch {
    /* ignora */
  }
}

export function pendingInvite(): string {
  try {
    return sessionStorage.getItem(KEY) ?? new URLSearchParams(window.location.search).get('convite')?.toUpperCase() ?? ''
  } catch {
    return ''
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignora */
  }
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/?convite=${code}`
}
