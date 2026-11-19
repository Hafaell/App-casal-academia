/**
 * Testes das telas de ponta a ponta, com o roteador de verdade e o Supabase simulado em memória.
 * Cada teste abre o app numa rota e usa os botões como a pessoa usaria.
 */
import { act, configure, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { createFakeSupabase } from './fakeSupabase'
import { fakeState } from './fakeState'
import { GYM, NOW, seedCouple } from './fixture'

jest.setTimeout(30_000)
// As respostas do Supabase simulado passam por várias promessas: dá mais tempo para a tela atualizar.
configure({ asyncUtilTimeout: 5000 })

beforeEach(() => {
  jest.useFakeTimers({ now: NOW })
})

afterEach(() => {
  jest.useRealTimers()
})

const open = (url = '/') => renderRouter('./src/app', { initialUrl: url })
/** Toque e digitação esperando o app reagir (as respostas do Supabase simulado são assíncronas). */
async function press(el: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(el)
  })
}
async function type(el: Parameters<typeof fireEvent.changeText>[0], text: string) {
  await act(async () => {
    fireEvent.changeText(el, text)
  })
}
const tap = (text: string | RegExp) => press(screen.getByText(text))

describe('entrar e começar', () => {
  it('recusa senha errada, entra, cria o grupo e chega no Início', async () => {
    const fake = createFakeSupabase()
    fakeState.supabase = fake
    fake.addUser('u9', 'Bia', 'bia@teste.com', 'segredo123')

    await open('/')
    expect(await screen.findByText('4 treinos por semana. Quem falhar, paga.')).toBeTruthy()

    await type(screen.getByLabelText('E-mail'), 'bia@teste.com')
    await type(screen.getByLabelText('Senha'), 'errada1')
    await press(screen.getAllByText('Entrar').at(-1)!)
    expect(await screen.findByText('E-mail ou senha incorretos')).toBeTruthy()

    await type(screen.getByLabelText('Senha'), 'segredo123')
    await press(screen.getAllByText('Entrar').at(-1)!)
    expect(await screen.findByText('Bem-vindo!')).toBeTruthy()

    await tap('Criar grupo')
    expect(await screen.findByText('Semana 16/11 a 22/11')).toBeTruthy()
    // Grupo novo exige academia: o botão principal leva ao cadastro.
    expect(await screen.findByText('📍 Cadastrar a minha academia')).toBeTruthy()
    expect(fake.db.groups).toHaveLength(1)
    expect(fake.db.group_members[0]).toMatchObject({ user_id: 'u9', role: 'owner' })
  })

  it('cria conta nova e entra num grupo pelo código', async () => {
    const fake = seedCouple()
    await act(() => fake.client.auth.signOut())

    await open('/')
    await tap('Criar conta')
    await type(await screen.findByLabelText('Seu nome'), 'Caio')
    await type(screen.getByLabelText('E-mail'), 'caio@teste.com')
    await type(screen.getByLabelText('Senha'), '123')
    await press(screen.getAllByText('Criar conta').at(-1)!)
    expect(await screen.findByText('A senha precisa ter pelo menos 6 caracteres')).toBeTruthy()

    await type(screen.getByLabelText('Senha'), '123456')
    await press(screen.getAllByText('Criar conta').at(-1)!)
    expect(await screen.findByText('Bem-vindo!')).toBeTruthy()

    await type(screen.getByLabelText('Código'), 'xyz789')
    await tap('Entrar no grupo')
    expect(await screen.findByText('Nós dois')).toBeTruthy()
    expect(fake.db.group_members.map((m) => m.user_id)).toContain(fake.db.profiles.find((p) => p.display_name === 'Caio')!.id)
  })
})

describe('Início e check-in', () => {
  it('mostra o placar dos dois e o resultado da semana fechada', async () => {
    seedCouple()
    await open('/')
    expect(await screen.findByText('Semana 16/11 a 22/11')).toBeTruthy()
    expect(await screen.findByText('Faltam 2 em 4 dias')).toBeTruthy()
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(screen.getByText('Semana 09/11 a 15/11 fechada')).toBeTruthy()
    expect(screen.getByText(/Ana paga/)).toBeTruthy()
    expect(screen.getByText('4 dias restantes · meta de 4 treinos')).toBeTruthy()
  })

  it('registra o treino com foto na academia e volta para o Início', async () => {
    const fake = seedCouple()
    await open('/')
    // O botão espera a lista de academias carregar.
    await waitFor(() => expect(screen.getByRole('button', { name: '📸 Fiz meu treino' })).toBeEnabled())
    await press(screen.getByText('📸 Fiz meu treino'))

    expect(await screen.findByText('📍 Smart Fit Centro · 22 m')).toBeTruthy()
    await press(screen.getByLabelText('Tirar foto'))
    await press(await screen.findByText('Musculação'))
    await press(screen.getByText('Registrar treino'))

    expect(await screen.findByText('✓ Treino de hoje registrado')).toBeTruthy()
    const mine = fake.db.checkins.filter((c) => c.user_id === 'u1' && c.day === '2026-11-18')
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ kind: 'musculacao', gym_name: 'Smart Fit Centro' })
    expect(fake.uploads).toEqual([mine[0].photo_path])
  })

  it('bloqueia a foto longe da academia', async () => {
    seedCouple()
    fakeState.position = { lat: GYM.lat + 0.01, lng: GYM.lng, accuracy: 10 } // ~1,1 km
    await open('/check-in')
    expect(await screen.findByText(/Você está a 1,1 km de Smart Fit Centro/)).toBeTruthy()
    expect(screen.getByLabelText('Tirar foto')).toBeDisabled()
  })
})

describe('Feed', () => {
  it('lista os treinos, reage com emoji e cancela o treino do outro', async () => {
    const fake = seedCouple()
    await open('/feed')
    expect((await screen.findAllByText('Rafael treinou 💪')).length).toBe(2)
    expect(screen.getByText('Ana treinou 💪')).toBeTruthy()
    expect(screen.getByText(/Ana: R\$\s?30 \+ Lavar a louça/)).toBeTruthy()

    await press(screen.getAllByText('🔥')[0])
    await waitFor(() => expect(fake.db.reactions).toHaveLength(1))

    await press(screen.getByText('🚩 Reportar'))
    await type(await screen.findByPlaceholderText(/Motivo/), 'Foto em casa')
    await press(screen.getByText('Cancelar este treino'))
    expect(await screen.findByText('Motivo: “Foto em casa”')).toBeTruthy()
    expect(fake.db.checkins.some((c) => c.id === 'c3')).toBe(false)
  })
})

describe('Caixinha e Histórico', () => {
  it('marca a multa como paga e atualiza os totais', async () => {
    const fake = seedCouple()
    await open('/caixinha')
    expect(await screen.findByText('Falta pagar')).toBeTruthy()
    await press(await screen.findByText('Marcar pago'))
    expect(await screen.findByText(/Pago 18\/11/)).toBeTruthy()
    expect(fake.db.week_results.find((r) => r.user_id === 'u2')!.paid_at).toBeTruthy()
    expect(screen.getByText('💸 Retirar')).toBeTruthy()
  })

  it('mostra o mês e a semana fechada no Histórico', async () => {
    seedCouple()
    await open('/historico')
    expect(await screen.findByText('Novembro de 2026')).toBeTruthy()
    expect(await screen.findByText('09/11 a 15/11')).toBeTruthy()
    expect(screen.getByText('Teve punição')).toBeTruthy()
  })
})

describe('Mais', () => {
  it('adiciona uma punição na roleta', async () => {
    const fake = seedCouple()
    await open('/mais')
    await press(await screen.findByText('Roleta de punições'))
    await press(await screen.findByText('+ Nova'))
    await type(await screen.findByLabelText('O que a pessoa tem que fazer'), 'Fazer o jantar')
    await tap('Salvar')
    expect(await screen.findByText('Fazer o jantar')).toBeTruthy()
    expect(fake.db.punishments).toHaveLength(3)
  })

  it('marca exceção e usa o coringa', async () => {
    const fake = seedCouple()
    await open('/excecoes')
    await press(await screen.findByText('19/11'))
    await tap('Doença')
    await tap('Marcar exceção')
    expect(await screen.findByText('Suas exceções')).toBeTruthy()
    expect(fake.db.exceptions[0]).toMatchObject({ user_id: 'u1', day: '2026-11-19', reason: 'doenca' })

    await tap('Usar coringa nesta semana')
    expect(await screen.findByText('Coringa usado na semana 16/11 a 22/11')).toBeTruthy()
    expect(fake.db.jokers[0]).toMatchObject({ user_id: 'u1', week_start: '2026-11-16' })
  })

  it('salva as regras do grupo e recusa multa máxima menor que a mínima', async () => {
    const fake = seedCouple()
    await open('/grupo')
    expect(await screen.findByText('XYZ789')).toBeTruthy()
    await type(screen.getByLabelText('Multa máxima (R$)'), '5')
    await tap('Salvar regras')
    expect(await screen.findByText('A multa máxima precisa ser maior que a mínima')).toBeTruthy()

    await type(screen.getByLabelText('Multa máxima (R$)'), '80')
    await type(screen.getByLabelText('Meta de treinos por semana'), '5')
    await tap('Salvar regras')
    expect(await screen.findByText('Regras salvas')).toBeTruthy()
    expect(fake.db.groups[0]).toMatchObject({ weekly_goal: 5, fine_max: 80 })
  })

  it('lista as academias e cadastra uma pela posição atual', async () => {
    const fake = seedCouple()
    await open('/academias')
    expect(await screen.findByText('Smart Fit Centro')).toBeTruthy()
    expect(screen.getByText('Academia da Ana')).toBeTruthy()
    await type(screen.getAllByLabelText('Nome da academia').at(-1)!, 'Academia do bairro')
    await tap('Usar minha localização')
    expect(await screen.findByText('Academia cadastrada na sua posição atual')).toBeTruthy()
    expect(fake.db.gyms.at(-1)).toMatchObject({ name: 'Academia do bairro', created_by: 'u1' })
  })

  it('mostra a sequência e sai da conta', async () => {
    seedCouple()
    await open('/mais')
    await press(await screen.findByText('Sequência'))
    expect(await screen.findByText('semanas seguidas · recorde 0')).toBeTruthy()
    await press(screen.getByText('‹ Voltar'))
    await press(await screen.findByText('Sair da conta'))
    expect(await screen.findByText('4 treinos por semana. Quem falhar, paga.')).toBeTruthy()
  })
})
