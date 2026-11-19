import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Field, Input, Txt, useToast } from '@/components/ui'
import { useCreateGroup, useJoinGroup } from '@/data/queries'
import { clearPendingInvite, pendingInvite } from '@/lib/invite'
import { errorMessage, supabase } from '@/lib/supabase'
import { colors } from '@/lib/theme'

export function OnboardingScreen() {
  const insets = useSafeAreaInsets()
  const [groupName, setGroupName] = useState('Nós dois')
  const [code, setCode] = useState(pendingInvite())
  const create = useCreateGroup()
  const join = useJoinGroup()
  const toast = useToast()

  function onCreate() {
    if (!groupName.trim()) return toast('Informe o nome do grupo', 'error')
    create.mutate(groupName, { onError: (err) => toast(errorMessage(err), 'error') })
  }

  function onJoin() {
    if (!code.trim()) return toast('Informe o código do convite', 'error')
    join.mutate(code, {
      onSuccess: () => clearPendingInvite(),
      onError: (err) => toast(errorMessage(err), 'error'),
    })
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 40, paddingBottom: 40, gap: 20 }}>
        <View>
          <Txt size={24} weight="700">
            Bem-vindo!
          </Txt>
          <Txt muted style={{ marginTop: 4 }}>
            Crie o grupo do casal ou entre com o código que seu par mandou.
          </Txt>
        </View>

        <Card style={{ gap: 12 }}>
          <Txt weight="600">Tenho um convite</Txt>
          <Field label="Código">
            <Input
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), letterSpacing: 4 }}
            />
          </Field>
          <Button onPress={onJoin} loading={join.isPending}>
            Entrar no grupo
          </Button>
        </Card>

        <Card style={{ gap: 12 }}>
          <Txt weight="600">Criar um grupo novo</Txt>
          <Field label="Nome do grupo">
            <Input value={groupName} onChangeText={setGroupName} maxLength={60} />
          </Field>
          <Txt size={12} muted>
            Meta de 4 treinos por semana, multa de R$10 a R$50 e a roleta sugerida. Dá para mudar tudo depois.
          </Txt>
          <Button variant="secondary" onPress={onCreate} loading={create.isPending}>
            Criar grupo
          </Button>
        </Card>

        <Button variant="ghost" onPress={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
