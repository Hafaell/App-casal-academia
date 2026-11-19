/** Cores do app (as mesmas do site, em src/index.css). */
export const colors = {
  bg: '#0b0f14',
  surface: '#141a22',
  surface2: '#1c2430',
  line: '#263040',
  ink: '#eef2f6',
  muted: '#8b97a8',
  accent: '#c6f432',
  accentInk: '#11160a',
  danger: '#fb7185',
  warn: '#fbbf24',
  ok: '#4ade80',
  white: '#ffffff',
  black: '#000000',
} as const

/** Cor com transparência, a partir de uma cor #rrggbb. Ex.: alpha(colors.ok, 0.1). */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
