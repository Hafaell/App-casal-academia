import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Chip, Field, Input, Txt } from '@/components/ui'
import { errorMessage, supabase } from '@/lib/supabase'
import { colors } from '@/lib/theme'

export function LoginScreen() {
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  // Recuperar senha: 1) pede o código por e-mail; 2) digita o código e a senha nova.
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function sendCode() {
    setError('')
    setInfo('')
    if (!email.trim()) return setError('Informe o e-mail da sua conta')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) throw error
      setCodeSent(true)
      setInfo('Se existir uma conta com esse e-mail, chega um código de 6 números em alguns minutos. Olhe também o spam.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword() {
    setError('')
    setInfo('')
    if (!/^\d{6}$/.test(code.trim())) return setError('Digite o código de 6 números do e-mail')
    if (password.length < 6) return setError('A senha nova precisa ter pelo menos 6 caracteres')
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' })
      if (error) throw error
      // O código já deixa a pessoa logada; agora troca a senha.
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function goTo(next: 'login' | 'signup' | 'reset') {
    setMode(next)
    setError('')
    setInfo('')
    setCodeSent(false)
    setCode('')
    setPassword('')
  }

  async function submit() {
    if (mode === 'reset') return codeSent ? resetPassword() : sendCode()
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

        {mode === 'reset' ? (
          <View style={{ marginBottom: 24 }}>
            <Txt size={18} weight="700">
              Recuperar senha
            </Txt>
            <Txt size={14} muted style={{ marginTop: 4 }}>
              {codeSent ? 'Digite o código que chegou no e-mail e escolha uma senha nova.' : 'Enviamos um código de 6 números para o e-mail da sua conta.'}
            </Txt>
          </View>
        ) : (
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {(['login', 'signup'] as const).map((m) => (
            <Chip
              key={m}
              label={m === 'login' ? 'Entrar' : 'Criar conta'}
              active={mode === m}
              onPress={() => goTo(m)}
              style={{ flex: 1, borderRadius: 8, paddingVertical: 9, backgroundColor: mode === m ? colors.surface2 : 'transparent' }}
            />
          ))}
        </View>
        )}

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
          {mode === 'reset' && codeSent && (
            <Field label="Código do e-mail">
              <Input value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
            </Field>
          )}
          {(mode !== 'reset' || codeSent) && (
          <Field label={mode === 'reset' ? 'Senha nova' : 'Senha'}>
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
          )}
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
            {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : codeSent ? 'Trocar a senha e entrar' : 'Enviar código'}
          </Button>
          {mode === 'login' && (
            <Pressable onPress={() => goTo('reset')} accessibilityRole="button" hitSlop={8}>
              <Txt size={14} color={colors.accent} center>
                Esqueci a senha
              </Txt>
            </Pressable>
          )}
          {mode === 'reset' && (
            <View style={{ gap: 12 }}>
              {codeSent && (
                <Pressable onPress={sendCode} accessibilityRole="button" hitSlop={8}>
                  <Txt size={14} color={colors.accent} center>
                    Mandar outro código
                  </Txt>
                </Pressable>
              )}
              <Pressable onPress={() => goTo('login')} accessibilityRole="button" hitSlop={8}>
                <Txt size={14} muted center>
                  Voltar para entrar
                </Txt>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
