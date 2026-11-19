import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { AuthProvider } from '@/providers/AuthProvider'
import { FullScreenMessage, ToastProvider, Txt } from '@/components/ui'
import { capturePendingInvite } from '@/lib/invite'
import { isConfigured, supabase } from '@/lib/supabase'
import { colors } from '@/lib/theme'

// No celular não existe "foco da janela": o React Query recarrega quando o app volta para a tela.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') handleFocus(state === 'active')
  })
  return () => sub.remove()
})

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    },
  })
}

export default function RootLayout() {
  const [queryClient] = useState(makeQueryClient)

  // Link de convite (treinoadois://?convite=ABC123): guarda o código até a pessoa entrar.
  const url = Linking.useLinkingURL()
  useEffect(() => capturePendingInvite(url), [url])

  // Ao sair da conta, esquece os dados da conta anterior.
  useEffect(() => {
    if (!isConfigured) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="light" />
            {isConfigured ? (
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
            ) : (
              <FullScreenMessage
                title="Falta configurar o Supabase"
                detail={
                  <Txt size={14} muted center>
                    Crie o arquivo .env.local na pasta mobile com EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (veja o
                    mobile/README.md).
                  </Txt>
                }
              />
            )}
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
