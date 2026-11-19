import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './app/AuthProvider'
import { GroupProvider } from './app/GroupProvider'
import { Layout } from './components/Layout'
import { FullScreenMessage, Spinner } from './components/ui'
import { useMyGroups } from './data/queries'
import { isConfigured } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { HomePage } from './pages/HomePage'
import { CheckinPage } from './pages/CheckinPage'
import { FeedPage } from './pages/FeedPage'
import { HistoryPage } from './pages/HistoryPage'
import { KittyPage } from './pages/KittyPage'
import { MorePage } from './pages/MorePage'
import { StreakPage } from './pages/StreakPage'
import { RoulettePage } from './pages/RoulettePage'
import { ExceptionsPage } from './pages/ExceptionsPage'
import { GroupSettingsPage } from './pages/GroupSettingsPage'
import { GymsPage } from './pages/GymsPage'

export function App() {
  if (!isConfigured) {
    return (
      <FullScreenMessage
        title="Falta configurar o Supabase"
        detail={
          <>
            Crie o arquivo <code>.env.local</code> com <code>VITE_SUPABASE_URL</code> e{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> (veja o README).
          </>
        }
      />
    )
  }
  return <Gate />
}

function Gate() {
  const { session, loading } = useAuth()
  const userId = session?.user.id
  const groups = useMyGroups(userId)

  if (loading) return <Spinner fullScreen />
  if (!session) return <LoginPage />
  if (groups.isLoading) return <Spinner fullScreen />
  if (groups.error)
    return <FullScreenMessage title="Não foi possível carregar seus grupos" detail={String(groups.error)} />
  if (!groups.data || groups.data.length === 0) return <OnboardingPage />

  return (
    <GroupProvider groups={groups.data} userId={userId!}>
      <Routes>
        <Route path="/check-in" element={<CheckinPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="historico" element={<HistoryPage />} />
          <Route path="caixinha" element={<KittyPage />} />
          <Route path="mais" element={<MorePage />} />
          <Route path="sequencia" element={<StreakPage />} />
          <Route path="roleta" element={<RoulettePage />} />
          <Route path="excecoes" element={<ExceptionsPage />} />
          <Route path="grupo" element={<GroupSettingsPage />} />
          <Route path="academias" element={<GymsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </GroupProvider>
  )
}
