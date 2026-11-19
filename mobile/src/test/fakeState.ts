/** Estado compartilhado entre os mocks e os testes (cada teste troca por um novo). */
import type { FakeSupabase } from './fakeSupabase'

export const fakeState: {
  supabase: FakeSupabase | null
  /** Posição que o "GPS" devolve. */
  position: { lat: number; lng: number; accuracy: number }
  clipboard: string
} = {
  supabase: null,
  position: { lat: 0, lng: 0, accuracy: 10 },
  clipboard: '',
}
