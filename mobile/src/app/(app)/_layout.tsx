import { useEffect, useState } from 'react'
import { Redirect, Stack } from 'expo-router'
import { FullScreenMessage, Spinner } from '@/components/ui'
import { useMyGroups } from '@/data/queries'
import { useAuth } from '@/providers/AuthProvider'
import { GroupProvider, readSelectedGroup } from '@/providers/GroupProvider'
import { colors } from '@/lib/theme'

// Abrir um link direto para o check-in ainda deixa as abas por baixo (o Cancelar volta para elas).
export const unstable_settings = { anchor: '(tabs)' }

/** Portão: sem login vai para Entrar; sem grupo, para Boas-vindas; senão abre o app do grupo. */
export default function AppLayout() {
  const { session, loading } = useAuth()
  const userId = session?.user.id
  const groups = useMyGroups(userId)
  const [selected, setSelected] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    readSelectedGroup().then(setSelected)
  }, [])

  if (loading) return <Spinner fullScreen />
  if (!session) return <Redirect href="/entrar" />
  if (groups.isLoading || selected === undefined) return <Spinner fullScreen />
  if (groups.error) return <FullScreenMessage title="Não foi possível carregar seus grupos" detail={String(groups.error)} />
  if (!groups.data || groups.data.length === 0) return <Redirect href="/boas-vindas" />

  return (
    <GroupProvider groups={groups.data} userId={userId!} initialSelected={selected}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="check-in" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
    </GroupProvider>
  )
}
