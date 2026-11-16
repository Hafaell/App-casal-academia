import { describe, expect, it } from 'vitest'
import { checkLocation, distanceMeters, formatDistance, nearest } from './geo'

const gym = { name: 'Smart Fit Centro', lat: -23.5505, lng: -46.6333 }
const other = { name: 'Bodytech', lat: -23.5615, lng: -46.6559 }

describe('localização', () => {
  it('calcula distância igual ao banco', () => {
    expect(distanceMeters(gym, gym)).toBe(0)
    expect(Math.abs(distanceMeters({ lat: -23.55, lng: -46.63 }, { lat: -22.55, lng: -46.63 }) - 111195)).toBeLessThan(50)
    // Mesmos pontos do teste do banco: ~200 m e ~1 km.
    expect(Math.round(distanceMeters({ lat: -23.5487, lng: -46.6333 }, gym))).toBeGreaterThanOrEqual(195)
    expect(Math.round(distanceMeters({ lat: -23.5415, lng: -46.6333 }, gym))).toBe(1001)
  })

  it('acha a academia mais próxima', () => {
    expect(nearest({ lat: -23.561, lng: -46.655 }, [gym, other])?.place.name).toBe('Bodytech')
    expect(nearest(gym, [])).toBeNull()
  })

  it('aprova até 300 m e recusa além disso', () => {
    expect(checkLocation({ lat: -23.5487, lng: -46.6333, accuracy: 20 }, [gym]).status).toBe('ok')
    expect(checkLocation({ lat: -23.5478, lng: -46.6333 }, [gym]).status).toBe('ok')
    const far = checkLocation({ lat: -23.5415, lng: -46.6333, accuracy: 20 }, [gym])
    expect(far).toMatchObject({ status: 'far', distance: 1001 })
  })

  it('pede para tentar de novo com GPS fraco ou sem academia', () => {
    expect(checkLocation({ ...gym, accuracy: 900 }, [gym]).status).toBe('weak-signal')
    expect(checkLocation(gym, []).status).toBe('no-gym')
  })

  it('formata distâncias', () => {
    expect(formatDistance(45.4)).toBe('45 m')
    expect(formatDistance(1234)).toBe('1,2 km')
    expect(formatDistance(25300)).toBe('25 km')
  })
})
