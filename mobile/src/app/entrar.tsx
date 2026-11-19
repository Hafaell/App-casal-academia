import { Redirect } from 'expo-router'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { LoginScreen } from '@/screens/LoginScreen'

export default function EntrarRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Spinner fullScreen />
  if (session) return <Redirect href="/" />
  return <LoginScreen />
}
