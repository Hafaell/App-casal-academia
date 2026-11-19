import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Chip, Field, Input, Txt } from '@/components/ui'
import { errorMessage, supabase } from '@/lib/supabase'
import { colors } from '@/lib/theme'

export function LoginScreen() {
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit() {
    setError('')
    setInfo('')
    // O navegador validava os campos (required, minLength); aqui a conferência é feita antes de enviar.
    if (mode === 'signup' && !name.trim()) return setError('Informe seu nome')
    if (!email.trim()) return setError('Informe o e-mail')
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Conta criada. Confirme pelo link que enviamos para o seu e-mail e depois entre aqui.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 40, paddingBottom: 40 }}
      >
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
          >
            <Txt size={30}>🏋️</Txt>
          </View>
          <Txt size={30} weight="700">
            Treino a Dois
          </Txt>
          <Txt muted style={{ marginTop: 8 }}>
            4 treinos por semana. Quem falhar, paga.
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {(['login', 'signup'] as const).map((m) => (
            <Chip
              key={m}
              label={m === 'login' ? 'Entrar' : 'Criar conta'}
              active={mode === m}
              onPress={() => setMode(m)}
              style={{ flex: 1, borderRadius: 8, paddingVertical: 9, backgroundColor: mode === m ? colors.surface2 : 'transparent' }}
            />
          ))}
        </View>

        <View style={{ gap: 16 }}>
          {mode === 'signup' && (
            <Field label="Seu nome">
              <Input value={name} onChangeText={setName} maxLength={40} autoComplete="given-name" textContentType="givenName" />
            </Field>
          )}
          <Field label="E-mail">
            <Input
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Field label="Senha">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              onSubmitEditing={submit}
            />
          </Field>
          {error ? (
            <Txt size={14} color={colors.danger}>
              {error}
            </Txt>
          ) : null}
          {info ? (
            <Txt size={14} color={colors.ok}>
              {info}
            </Txt>
          ) : null}
          <Button onPress={submit} loading={loading} style={{ width: '100%' }}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
