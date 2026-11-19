import { Link } from 'react-router'
import { useGroup } from '@/app/GroupProvider'
import { PageHeader } from '@/components/ui'
import { supabase } from '@/lib/supabase'

const items = [
  { to: '/academias', icon: '📍', title: 'Academias', desc: 'Onde o check-in vale (até 300 m pelo GPS)' },
  { to: '/excecoes', icon: '🩹', title: 'Exceções e coringa', desc: 'Doença, viagem, lesão, menstruação e o coringa do mês' },
  { to: '/sequencia', icon: '🔥', title: 'Sequência', desc: 'Semanas seguidas batendo a meta' },
  { to: '/roleta', icon: '🎡', title: 'Roleta de punições', desc: 'Adicionar, editar ou remover punições' },
  { to: '/grupo', icon: '⚙️', title: 'Grupo e regras', desc: 'Meta, multa, convite e seu nome' },
]

export function MorePage() {
  const { group } = useGroup()
  return (
    <div>
      <PageHeader title="Mais" subtitle={group.name} />
      <ul className="space-y-2 px-4 pt-4">
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2">
              <span className="text-2xl">{i.icon}</span>
              <span className="flex-1">
                <span className="block font-semibold">{i.title}</span>
                <span className="block text-xs text-muted">{i.desc}</span>
              </span>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}
        <li className="pt-4">
          <button className="w-full rounded-2xl py-3 text-sm text-muted" onClick={() => supabase.auth.signOut()}>
            Sair da conta
          </button>
        </li>
      </ul>
    </div>
  )
}
