import { NavLink, Outlet } from 'react-router'
import { cx } from './ui'

const tabs = [
  { to: '/', label: 'Início', icon: IconHome, end: true },
  { to: '/feed', label: 'Feed', icon: IconFeed },
  { to: '/historico', label: 'Histórico', icon: IconCalendar },
  { to: '/caixinha', label: 'Caixinha', icon: IconCoin },
  { to: '/mais', label: 'Mais', icon: IconMore },
]

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
        <ul className="mx-auto flex max-w-md justify-around px-2 pt-1.5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx('flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium', isActive ? 'text-accent' : 'text-muted')
                }
              >
                <Icon />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

function IconHome() {
  return (
    <Svg>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </Svg>
  )
}
function IconFeed() {
  return (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L6 21" />
    </Svg>
  )
}
function IconCalendar() {
  return (
    <Svg>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </Svg>
  )
}
function IconCoin() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.6 0-2.8.8-2.8 2s1.2 1.6 2.8 2 2.8.8 2.8 2-1.2 2-2.8 2c-1.3 0-2.4-.5-2.9-1.3M12 6.5V8M12 16v1.5" />
    </Svg>
  )
}
function IconMore() {
  return (
    <Svg>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </Svg>
  )
}
