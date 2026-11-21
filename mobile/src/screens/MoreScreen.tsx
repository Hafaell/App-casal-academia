import { Pressable, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { useGroup } from '@/providers/GroupProvider'
import { PageHeader, Screen, Txt } from '@/components/ui'
import { GYM_RADIUS_M } from '@domain/geo'
import { supabase } from '@/lib/supabase'
import { colors } from '@/lib/theme'

const items: { to: Href; icon: string; title: string; desc: string }[] = [
  { to: '/academias', icon: '📍', title: 'Academias', desc: `Onde o check-in vale (até ${GYM_RADIUS_M} m pelo GPS)` },
  { to: '/excecoes', icon: '🩹', title: 'Exceções e coringa', desc: 'Doença, viagem, lesão, menstruação e o coringa do mês' },
  { to: '/historia', icon: '💑', title: 'Nossa história', desc: 'Relatório do mês: treinos, treinos juntos e multas' },
  { to: '/compartilhar', icon: '📤', title: 'Stories e colagens', desc: 'Imagens para compartilhar: treinamos juntos, o mês e o ano' },
  { to: '/planejar', icon: '🗓️', title: 'Planejar a semana', desc: 'Dias em que cada um vai treinar e o "vamos?"' },
  { to: '/premios', icon: '🎁', title: 'Roleta de prêmios', desc: 'Um giro a cada 2 semanas seguidas de meta batida' },
  { to: '/sequencia', icon: '🔥', title: 'Sequência', desc: 'Semanas seguidas batendo a meta' },
  { to: '/roleta', icon: '🎡', title: 'Roleta de punições', desc: 'Adicionar, editar ou remover punições' },
  { to: '/grupo', icon: '⚙️', title: 'Grupo e regras', desc: 'Meta, multa, convite e seu nome' },
]

export function MoreScreen() {
  const { group } = useGroup()
  return (
    <Screen header={<PageHeader title="Mais" subtitle={group.name} />}>
      <View style={{ gap: 8 }}>
        {items.map((i) => (
          <Pressable
            key={i.title}
            onPress={() => router.push(i.to)}
            accessibilityRole="link"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: pressed ? colors.surface2 : colors.surface,
              padding: 16,
            })}
          >
            <Txt size={24}>{i.icon}</Txt>
            <View style={{ flex: 1 }}>
              <Txt weight="600">{i.title}</Txt>
              <Txt size={12} muted>
                {i.desc}
              </Txt>
            </View>
            <Txt muted>›</Txt>
          </Pressable>
        ))}
        <Pressable onPress={() => supabase.auth.signOut()} style={{ paddingVertical: 12, marginTop: 16 }} accessibilityRole="button">
          <Txt size={14} muted center>
            Sair da conta
          </Txt>
        </Pressable>
      </View>
    </Screen>
  )
}
