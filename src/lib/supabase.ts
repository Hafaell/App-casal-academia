import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export const PHOTO_BUCKET = 'checkins'

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
  if (msg.includes('Failed to fetch')) return 'Sem conexão. Tente de novo.'
  return msg
}
