import { describe, expect, it } from 'vitest'
import { addDays, daysInMonth, firstMondayFrom, isoDow, localDate, localToday, mondayOf, weekRange } from './dates'

describe('datas', () => {
  it('calcula a segunda-feira da semana', () => {
    expect(mondayOf('2026-11-13')).toBe('2026-11-09') // sexta
    expect(mondayOf('2026-11-09')).toBe('2026-11-09') // segunda
    expect(mondayOf('2026-11-15')).toBe('2026-11-09') // domingo
  })

  it('isoDow segue o padrão do Postgres', () => {
    expect(isoDow('2026-11-09')).toBe(1)
    expect(isoDow('2026-11-15')).toBe(7)
  })

  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('usa o fuso do grupo, não o do aparelho', () => {
    // 02:30 UTC de sábado ainda é sexta 23:30 em São Paulo.
    const instant = new Date('2026-11-14T02:30:00Z')
    expect(localToday('America/Sao_Paulo', instant)).toBe('2026-11-13')
    expect(localDate(instant, 'UTC')).toBe('2026-11-14')
  })

  it('formata o intervalo da semana', () => {
    expect(weekRange('2026-10-05')).toBe('05/10 a 11/10')
  })

  it('primeira segunda-feira para quem entra', () => {
    expect(firstMondayFrom('2026-11-09')).toBe('2026-11-09')
    expect(firstMondayFrom('2026-11-13')).toBe('2026-11-16')
  })

  it('dias no mês', () => {
    expect(daysInMonth('2026-02-10')).toBe(28)
    expect(daysInMonth('2028-02-10')).toBe(29)
  })
})
