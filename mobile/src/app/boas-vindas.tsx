import { Redirect } from 'expo-router'
import { FullScreenMessage, Spinner } from '@/components/ui'
import { useMyGroups } from '@/data/queries'
import { useAuth } from '@/providers/AuthProvider'
import { OnboardingScreen } from '@/screens/OnboardingScreen'

export default function BoasVindasRoute() {
  const { session, loading } = useAuth()
  const groups = useMyGroups(session?.user.id)
  if (loading) return <Spinner fullScreen />
  if (!session) return <Redirect href="/entrar" />
  if (groups.isLoading) return <Spinner fullScreen />
  if (groups.error) return <FullScreenMessage title="Não foi possível carregar seus grupos" detail={String(groups.error)} />
  if (groups.data && groups.data.length > 0) return <Redirect href="/" />
  return <OnboardingScreen />
}
