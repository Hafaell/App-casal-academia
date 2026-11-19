import AsyncStorage from '@react-native-async-storage/async-storage'

/** Lê um valor salvo no aparelho (equivale ao localStorage do site). Falha vira null. */
export async function readLocal(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key)
  } catch {
    return null
  }
}

export async function writeLocal(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value)
  } catch {
    /* sem armazenamento local: tudo bem */
  }
}
