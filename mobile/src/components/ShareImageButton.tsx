/**
 * Botão que monta a imagem e já abre o compartilhar do celular, num toque só.
 * Se o aparelho não tiver compartilhar, mostra a imagem na tela para a pessoa salvar com print.
 */
import { useState } from 'react'
import { Button, PhotoViewer, useToast } from '@/components/ui'
import { buildSummaryCard, shareImage, type SummaryCardData } from '@/lib/summaryCard'
import { errorMessage } from '@/lib/supabase'
import { colors } from '@/lib/theme'

export function ShareImageButton({
  label,
  dialogTitle,
  build,
  variant = 'ghost',
}: {
  label: string
  dialogTitle: string
  /** Chamado no toque: devolve o que desenhar. */
  build: () => SummaryCardData
  variant?: 'ghost' | 'primary'
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    try {
      const card = await buildSummaryCard(build())
      if (!(await shareImage(card, dialogTitle))) setPreview(card.uri)
    } catch (err) {
      // Aparece no terminal do Expo, para descobrir a causa se falhar no celular.
      console.warn('Falha ao compartilhar imagem:', err)
      toast(`Não consegui compartilhar: ${errorMessage(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        style={{ marginTop: 8 }}
        textStyle={variant === 'ghost' ? { color: colors.accent } : undefined}
        onPress={run}
        loading={busy}
      >
        {busy ? 'Preparando a imagem…' : label}
      </Button>
      <PhotoViewer url={preview} caption={dialogTitle} onClose={() => setPreview(null)} />
    </>
  )
}
