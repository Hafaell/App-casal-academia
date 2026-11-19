import { describe, expect, it } from 'vitest'
import { canShoot, gateFor, type GateInput } from './checkinGate'

const gym = { name: 'Smart Fit Centro', lat: -23.5505, lng: -46.6333 }
const near = { lat: -23.55005, lng: -46.6333, accuracy: 15 } // ~50 m
const far = { lat: -23.5415, lng: -46.6333, accuracy: 15 } // ~1 km

const base: GateInput<typeof gym> = {
  required: true,
  trainedToday: false,
  gyms: { status: 'ready', list: [gym] },
  position: near,
  gpsError: '',
}
const gate = (over: Partial<GateInput<typeof gym>>) => gateFor({ ...base, ...over })

describe('estado do check-in', () => {
  it('perto: libera', () => {
    const g = gate({})
    expect(g).toMatchObject({ kind: 'ok', distance: 50 })
    expect(canShoot(g)).toBe(true)
  })

  it('longe: bloqueia e diz a distância', () => {
    const g = gate({ position: far })
    expect(g).toMatchObject({ kind: 'far', distance: 1001 })
    expect(canShoot(g)).toBe(false)
  })

  it('sem academia cadastrada: bloqueia', () => {
    const g = gate({ gyms: { status: 'ready', list: [] } })
    expect(g.kind).toBe('no-gym')
    expect(canShoot(g)).toBe(false)
  })

  it('já treinou hoje: bloqueia antes de qualquer coisa', () => {
    expect(gate({ trainedToday: true }).kind).toBe('trained')
    expect(gate({ trainedToday: true, required: false }).kind).toBe('trained')
    expect(canShoot(gate({ trainedToday: true }))).toBe(false)
  })

  it('GPS negado ou ainda sem sinal: bloqueia, com mensagem certa', () => {
    expect(gate({ position: null, gpsError: 'Localização negada' })).toEqual({ kind: 'gps-error', message: 'Localização negada' })
    expect(gate({ position: null }).kind).toBe('waiting-gps')
    expect(canShoot(gate({ position: null }))).toBe(false)
  })

  it('GPS impreciso: espera', () => {
    const g = gate({ position: { ...near, accuracy: 900 } })
    expect(g).toEqual({ kind: 'weak-signal', accuracy: 900 })
    expect(canShoot(g)).toBe(false)
  })

  it('academias carregando ou com erro: bloqueia (nunca libera por engano)', () => {
    expect(gate({ gyms: { status: 'loading', list: [] } }).kind).toBe('gyms-loading')
    expect(gate({ gyms: { status: 'error', list: [] } }).kind).toBe('gyms-error')
    expect(canShoot(gate({ gyms: { status: 'error', list: [] } }))).toBe(false)
  })

  it('regra desligada: libera mesmo sem academia, sem GPS ou com erro nas academias', () => {
    for (const over of [
      { gyms: { status: 'ready' as const, list: [] } },
      { gyms: { status: 'error' as const, list: [] } },
      { position: null, gpsError: 'Localização negada' },
      { position: far },
    ]) {
      const g = gate({ required: false, ...over })
      expect(g.kind).toBe('free')
      expect(canShoot(g)).toBe(true)
    }
    expect(gate({ required: false })).toMatchObject({ kind: 'free', place: gym, distance: 50 })
  })
})
