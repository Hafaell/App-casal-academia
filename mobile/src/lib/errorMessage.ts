/** Mensagem amigável a partir de erros do Supabase/Postgres. */
export function errorMessage(err: unknown): string {
  if (!err) return 'Algo deu errado'
  if (typeof err === 'string') return err
  const e = err as { message?: string; code?: string }
  const msg = e.message ?? 'Algo deu errado'
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos'
  if (msg.includes('User already registered')) return 'Já existe uma conta com esse e-mail'
  if (msg.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos'
  if (msg.includes('Token has expired or is invalid') || msg.includes('otp_expired')) return 'Código inválido ou vencido. Peça um novo.'
  if (msg.includes('New password should be different')) return 'A senha nova precisa ser diferente da antiga'
  if (msg.includes('rate limit') || msg.includes('For security purposes')) return 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.'
  if (msg.includes('Failed to fetch') || msg.includes('Network request failed')) return 'Sem conexão. Tente de novo.'
  return msg
}
