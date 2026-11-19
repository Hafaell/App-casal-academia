import { Tabs } from 'expo-router/js-tabs'
import { IconCalendar, IconCoin, IconFeed, IconHome, IconMore } from '@/components/TabIcons'
import { colors } from '@/lib/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <IconHome color={color} /> }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: ({ color }) => <IconFeed color={color} /> }} />
      <Tabs.Screen name="historico" options={{ title: 'Histórico', tabBarIcon: ({ color }) => <IconCalendar color={color} /> }} />
      <Tabs.Screen name="caixinha" options={{ title: 'Caixinha', tabBarIcon: ({ color }) => <IconCoin color={color} /> }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais', tabBarIcon: ({ color }) => <IconMore color={color} /> }} />
    </Tabs>
  )
}
