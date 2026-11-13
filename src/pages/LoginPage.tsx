import { useState, type FormEvent } from 'react'
import { Button, Field, cx, inputClass } from '@/components/ui'
import { errorMessage, supabase } from '@/lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
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
    <div className="safe-top mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-3xl">🏋️</div>
        <h1 className="text-3xl font-bold tracking-tight">Treino a Dois</h1>
        <p className="mt-2 text-muted">4 treinos por semana. Quem falhar, paga.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-xl bg-surface p-1">
        {(['login', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cx('rounded-lg py-2 text-sm font-medium', mode === m ? 'bg-surface-2 text-ink' : 'text-muted')}
          >
            {m === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && (
          <Field label="Seu nome">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="given-name" />
          </Field>
        )}
        <Field label="E-mail">
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoCapitalize="none"
          />
        </Field>
        <Field label="Senha">
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        {info && <p className="text-sm text-ok">{info}</p>}
        <Button type="submit" loading={loading} className="w-full">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </Button>
      </form>
    </div>
  )
}
