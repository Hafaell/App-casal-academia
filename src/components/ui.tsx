import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  const dot = <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" role="status" aria-label="Carregando" />
  if (!fullScreen) return <div className="flex justify-center py-10">{dot}</div>
  return <div className="flex min-h-dvh items-center justify-center">{dot}</div>
}

export function FullScreenMessage({ title, detail, action }: { title: string; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {detail && <div className="text-sm text-muted">{detail}</div>}
      {action}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-surface p-4', className)}>{children}</div>
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  className,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-accent text-accent-ink font-semibold active:brightness-90',
    secondary: 'bg-surface-2 text-ink border border-line active:bg-line',
    ghost: 'text-muted active:text-ink',
    danger: 'bg-danger/15 text-danger border border-danger/30 active:bg-danger/25',
  }
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition disabled:opacity-50',
        styles[variant],
        className,
      )}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  )
}

const MEMBER_COLORS = ['#c6f432', '#38bdf8', '#f472b6', '#fbbf24', '#a78bfa', '#34d399']

export function memberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length]
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-bg"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-10 border-b border-line/60 bg-bg/90 px-4 pb-3 backdrop-blur">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {back && (
            <Link to={back} className="mb-1 inline-block text-sm text-muted">
              ‹ Voltar
            </Link>
          )}
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-6 py-12 text-center text-sm text-muted">{children}</p>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-ink placeholder:text-muted/70 outline-none focus:border-accent'

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="safe-bottom animate-pop max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {children}
      </div>
    </div>
  )
}

export function PhotoViewer({ url, caption, onClose }: { url: string | null; caption?: ReactNode; onClose: () => void }) {
  if (!url) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" onClick={onClose}>
      <div className="safe-top flex justify-end px-4">
        <button className="rounded-full bg-white/10 px-3 py-1.5 text-sm" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-2">
        <img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
      {caption && <div className="safe-bottom px-4 pb-4 text-center text-sm text-white/80">{caption}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------
// Avisos rápidos
// ---------------------------------------------------------------------
interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'animate-pop mt-2 max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg',
              t.tone === 'ok' ? 'bg-accent text-accent-ink' : 'bg-danger text-white',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
