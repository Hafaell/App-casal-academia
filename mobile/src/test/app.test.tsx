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

describe('Treino juntos', () => {
  it('mostra o selo no feed e a contagem do mês no Início', async () => {
    seedCouple()
    await open('/feed')
    // c1 (Rafael) e c3 (Ana) foram no mesmo dia, na mesma academia, com 1 hora de diferença.
    expect((await screen.findAllByText('💑 Treinaram juntos')).length).toBe(2)

    await open('/')
    expect(await screen.findByText('💑 Juntos 1 vez em novembro')).toBeTruthy()
  })
})

describe('Caixinha com objetivo e Pix', () => {
  it('cria o objetivo, junta o dinheiro e usa', async () => {
    const fake = seedCouple()
    await open('/caixinha')
    await press(await screen.findByText('🎯 Criar objetivo'))
    await type(await screen.findByLabelText('Objetivo'), 'Jantar japonês')
    await type(screen.getByLabelText('Valor do objetivo (R$)'), '20')
    await tap('Criar objetivo')
    expect(await screen.findByText('🎯 Jantar japonês')).toBeTruthy()
    expect(screen.getByText(/Faltam R\$\s?20/)).toBeTruthy()
    expect(fake.db.kitty_goals[0]).toMatchObject({ title: 'Jantar japonês', target_amount: 20, created_by: 'u1' })

    // A multa de R$ 30 entra na caixinha: o objetivo de R$ 20 fica completo.
    await press(await screen.findByText('Marcar pago'))
    expect(await screen.findByText('Chegou lá! 🎉')).toBeTruthy()
    await press(screen.getByText('🎉 Usar o dinheiro'))
    expect(await screen.findByText(/✓ Jantar japonês/)).toBeTruthy()
    expect(fake.db.kitty_withdrawals).toHaveLength(1)
    expect(fake.db.kitty_withdrawals[0]).toMatchObject({ amount: 20, description: 'Jantar japonês' })
    expect(fake.db.kitty_goals[0].completed_at).toBeTruthy()
    // A retirada do objetivo não tem "Desfazer".
    expect(screen.queryByText('Desfazer')).toBeNull()
    // Concluído, dá para criar o próximo.
    expect(screen.getByText('🎯 Criar objetivo')).toBeTruthy()
  })

  it('salva a chave Pix e copia o código da multa', async () => {
    const fake = seedCouple()
    await open('/caixinha')
    await press(await screen.findByText('Cadastrar'))
    await type(await screen.findByLabelText('Chave Pix'), 'rafa@teste.com')
    await tap('Salvar')
    // Com a janela aberta, o aviso aparece nela e na raiz do app.
    expect((await screen.findAllByText('Informe o nome de quem recebe')).length).toBeGreaterThan(0)
    expect(fake.db.groups[0].pix_key).toBeUndefined()

    await type(screen.getByLabelText('Nome de quem recebe'), 'Rafael')
    await type(screen.getByLabelText('Cidade'), 'Vitória')
    await tap('Salvar')
    expect(await screen.findByText('Chave Pix salva')).toBeTruthy()
    expect(fake.db.groups[0]).toMatchObject({ pix_key: 'rafa@teste.com', pix_name: 'Rafael', pix_city: 'Vitória' })

    await press(await screen.findByText(/Copiar Pix de R\$\s?30/))
    expect(await screen.findByText(/Pix copiado/)).toBeTruthy()
    expect(fakeState.clipboard).toMatch(/^000201/)
    expect(fakeState.clipboard).toContain('rafa@teste.com')
    expect(fakeState.clipboard).toContain('540530.00')
    expect(fakeState.clipboard).toContain('6007Vitoria')
  })

  it('sem a tabela de objetivos no banco, a Caixinha abre normal', async () => {
    const fake = seedCouple()
    fake.missingTables.add('kitty_goals')
    await open('/caixinha')
    expect(await screen.findByText('Falta pagar')).toBeTruthy()
    expect(await screen.findByText('Marcar pago')).toBeTruthy()
    expect(screen.queryByText('🎯 Criar objetivo')).toBeNull()
  })
})

describe('Nossa história', () => {
  it('mostra o relatório do mês, troca de mês e prepara as imagens', async () => {
    const { buildSummaryCard, shareImage } = jest.requireMock('@/lib/summaryCard')
    seedCouple()
    await open('/mais')
    await press(await screen.findByText('Nossa história'))
    expect(await screen.findByText('Novembro de 2026')).toBeTruthy()
    expect(await screen.findByText('💑 1')).toBeTruthy()
    expect(screen.getByText('Treinos no mês')).toBeTruthy()
    expect(screen.getByText('2 treinos')).toBeTruthy() // Rafael
    expect(screen.getByText('1 treino')).toBeTruthy() // Ana
    expect(screen.getByText('0/1')).toBeTruthy() // a semana fechada teve multa

    await press(screen.getByLabelText('Mês anterior'))
    expect(await screen.findByText('Outubro de 2026')).toBeTruthy()
    expect(screen.getByText('💑 0')).toBeTruthy()
    await press(screen.getByLabelText('Próximo mês'))
    expect(await screen.findByText('Novembro de 2026')).toBeTruthy()

    buildSummaryCard.mockClear()
    await tap('📤 Compartilhar o mês')
    await press(await screen.findByText('📤 Compartilhar o mês (pronto)'))
    expect(buildSummaryCard).toHaveBeenCalledWith(expect.objectContaining({ title: 'Novembro de 2026' }))
    expect(shareImage).toHaveBeenCalled()

    await tap('🖼️ Compartilhar a colagem de 2026')
    await waitFor(() => expect(buildSummaryCard).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nosso 2026', columns: 4 })))
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
