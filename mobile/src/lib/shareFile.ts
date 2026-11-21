/** Grava um texto num arquivo temporário do aparelho e abre o compartilhar (salvar, mandar por e-mail etc.). */
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'

export async function shareTextFile(name: string, text: string, mimeType: string, dialogTitle: string): Promise<boolean> {
  const file = new File(Paths.cache, name)
  if (file.exists) file.delete()
  file.create()
  file.write(text)
  if (!(await Sharing.isAvailableAsync())) return false
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle, UTI: mimeType === 'application/json' ? 'public.json' : undefined })
  return true
}
