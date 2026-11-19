import 'react-native-get-random-values'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import * as aesjs from 'aes-js'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

/**
 * Guarda a sessão de login no aparelho. O cofre do sistema (Keychain no iPhone, Keystore no
 * Android) só aceita valores pequenos, então ele guarda a chave e o conteúdo vai cifrado
 * no armazenamento comum. Mesmo esquema do guia oficial do Supabase para Expo.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8))
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1))
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value))
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey))
    return aesjs.utils.hex.fromBytes(encryptedBytes)
  }

  private async decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key)
    if (!encryptionKeyHex) return encryptionKeyHex
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1))
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value))
    return aesjs.utils.utf8.fromBytes(decryptedBytes)
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key)
    if (!encrypted) return encrypted
    return await this.decrypt(key, encrypted)
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key)
    await SecureStore.deleteItemAsync(key)
  }

  async setItem(key: string, value: string) {
    const encrypted = await this.encrypt(key, value)
    await AsyncStorage.setItem(key, encrypted)
  }
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    storage: new LargeSecureStore(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

// No celular o app vai para o fundo sem fechar: renova o login só enquanto está na tela.
AppState.addEventListener('change', (state) => {
  if (!isConfigured) return
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
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
  if (msg.includes('Failed to fetch') || msg.includes('Network request failed')) return 'Sem conexão. Tente de novo.'
  return msg
}
