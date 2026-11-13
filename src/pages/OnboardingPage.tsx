import { useState, type FormEvent } from 'react'
import { Button, Card, Field, inputClass, useToast } from '@/components/ui'
import { useCreateGroup, useJoinGroup } from '@/data/queries'
import { clearPendingInvite, pendingInvite } from '@/lib/invite'
import { errorMessage, supabase } from '@/lib/supabase'

export function OnboardingPage() {
  const [groupName, setGroupName] = useState('Nós dois')
  const [code, setCode] = useState(pendingInvite())
  const create = useCreateGroup()
  const join = useJoinGroup()
  const toast = useToast()

  function onCreate(e: FormEvent) {
    e.preventDefault()
    create.mutate(groupName, { onError: (err) => toast(errorMessage(err), 'error') })
  }

  function onJoin(e: FormEvent) {
    e.preventDefault()
    join.mutate(code, {
      onSuccess: () => clearPendingInvite(),
      onError: (err) => toast(errorMessage(err), 'error'),
    })
  }

  return (
    <div className="safe-top mx-auto min-h-dvh max-w-md space-y-5 px-5 py-10">
      <div>
        <h1 className="text-2xl font-bold">Bem-vindo!</h1>
        <p className="mt-1 text-muted">Crie o grupo do casal ou entre com o código que seu par mandou.</p>
      </div>

      <Card>
        <form onSubmit={onJoin} className="space-y-3">
          <h2 className="font-semibold">Tenho um convite</h2>
          <Field label="Código">
            <input
              className={`${inputClass} font-mono uppercase tracking-widest`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              required
              autoCapitalize="characters"
            />
          </Field>
          <Button type="submit" loading={join.isPending} className="w-full">
            Entrar no grupo
          </Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={onCreate} className="space-y-3">
          <h2 className="font-semibold">Criar um grupo novo</h2>
          <Field label="Nome do grupo">
            <input className={inputClass} value={groupName} onChange={(e) => setGroupName(e.target.value)} required maxLength={60} />
          </Field>
          <p className="text-xs text-muted">
            Meta de 4 treinos por semana, multa de R$10 a R$50 e a roleta sugerida. Dá para mudar tudo depois.
          </p>
          <Button type="submit" variant="secondary" loading={create.isPending} className="w-full">
            Criar grupo
          </Button>
        </form>
      </Card>

      <Button variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>
        Sair
      </Button>
    </div>
  )
}
