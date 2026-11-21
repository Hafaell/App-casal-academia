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

  it('recupera a senha com o código do e-mail', async () => {
    const fake = createFakeSupabase()
    fakeState.supabase = fake
    fake.addUser('u9', 'Bia', 'bia@teste.com', 'antiga123')

    await open('/')
    await tap('Esqueci a senha')
    await type(await screen.findByLabelText('E-mail'), 'bia@teste.com')
    await press(screen.getByText('Enviar código'))
    expect(await screen.findByText(/chega um código de 6 números/)).toBeTruthy()

    await type(screen.getByLabelText('Código do e-mail'), '000000')
    await type(screen.getByLabelText('Senha nova'), 'novaSenha1')
    await press(screen.getByText('Trocar a senha e entrar'))
    expect(await screen.findByText('Código inválido ou vencido. Peça um novo.')).toBeTruthy()

    await type(screen.getByLabelText('Código do e-mail'), '123456')
    await press(screen.getByText('Trocar a senha e entrar'))
    expect(await screen.findByText('Bem-vindo!')).toBeTruthy()

    // A senha nova passa a valer.
    await act(() => fake.client.auth.signOut())
    const res = await fake.client.auth.signInWithPassword({ email: 'bia@teste.com', password: 'novaSenha1' })
    expect(res.error).toBeNull()
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
    await press(await screen.findByText('Confirmar recebimento'))
    expect(await screen.findByText(/Recebido 18\/11/)).toBeTruthy()
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

describe('Confirmação do pagamento', () => {
  it('quem deve só avisa; o parceiro confirma e só então entra na caixinha', async () => {
    const fake = seedCouple()
    fake.login('u2', 'Ana')
    await open('/caixinha')
    await press(await screen.findByText('Já paguei'))
    expect(await screen.findByText(/Aguardando confirmação/)).toBeTruthy()
    const debt = fake.db.week_results.find((r) => r.user_id === 'u2')!
    expect(debt.paid_claimed_at).toBeTruthy()
    expect(debt.paid_at).toBeNull()

    fake.login('u1', 'Rafael')
    await open('/caixinha')
    expect(await screen.findByText(/Ana avisou que pagou em 18\/11/)).toBeTruthy()
    await press(screen.getByText('Confirmar recebimento'))
    expect(await screen.findByText(/Recebido 18\/11/)).toBeTruthy()
    expect(debt.paid_at).toBeTruthy()
    expect(debt.paid_marked_by).toBe('u1')
  })
})

describe('Caixinha com objetivo', () => {
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
    await press(await screen.findByText('Confirmar recebimento'))
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

  it('sem a tabela de objetivos no banco, a Caixinha abre normal', async () => {
    const fake = seedCouple()
    fake.missingTables.add('kitty_goals')
    await open('/caixinha')
    expect(await screen.findByText('Falta pagar')).toBeTruthy()
    expect(await screen.findByText('Confirmar recebimento')).toBeTruthy()
    expect(screen.queryByText('🎯 Criar objetivo')).toBeNull()
  })
})

describe('Nossa história', () => {
  it('mostra só o relatório do mês e troca de mês', async () => {
    seedCouple()
    await open('/mais')
    await press(await screen.findByText('Nossa história'))
    expect(await screen.findByText('Novembro de 2026')).toBeTruthy()
    expect(await screen.findByText('💑 1')).toBeTruthy()
    expect(screen.getByText('Treinos no mês')).toBeTruthy()
    expect(screen.getByText('2 treinos')).toBeTruthy() // Rafael
    expect(screen.getByText('1 treino')).toBeTruthy() // Ana
    expect(screen.getByText('0/1')).toBeTruthy() // a semana fechada teve multa
    // Compartilhar fica na outra tela.
    expect(screen.queryByText(/Compartilhar story|Compartilhar colagem/)).toBeNull()

    await press(screen.getByLabelText('Mês anterior'))
    expect(await screen.findByText('Outubro de 2026')).toBeTruthy()
    expect(screen.getByText('💑 0')).toBeTruthy()
    await press(screen.getByLabelText('Próximo mês'))
    expect(await screen.findByText('Novembro de 2026')).toBeTruthy()
  })
})

describe('Stories e colagens', () => {
  it('compartilha cada imagem com um toque só', async () => {
    const { buildSummaryCard, shareImage } = jest.requireMock('@/lib/summaryCard')
    seedCouple()
    await open('/mais')
    await press(await screen.findByText('Stories e colagens'))
    expect(await screen.findByText('💑 Story: treinamos juntos')).toBeTruthy()
    const buttons = await screen.findAllByText('📤 Compartilhar story')
    expect(buttons).toHaveLength(2)

    buildSummaryCard.mockClear()
    shareImage.mockClear()
    await press(buttons[0])
    await waitFor(() => expect(shareImage).toHaveBeenCalledTimes(1))
    expect(buildSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'story', highlight: expect.objectContaining({ value: '1' }) }),
    )

    await press(screen.getAllByText('📤 Compartilhar story')[1])
    await waitFor(() => expect(shareImage).toHaveBeenCalledTimes(2))
    expect(buildSummaryCard).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Novembro de 2026', format: 'story' }))

    await tap('📤 Compartilhar colagem')
    await waitFor(() => expect(shareImage).toHaveBeenCalledTimes(3))
    expect(buildSummaryCard).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Nosso 2026', columns: 4, format: 'story' }))

    // Mês sem treinos: nada para compartilhar.
    await press(screen.getByLabelText('Mês anterior'))
    expect(await screen.findByText('Ainda não há treino a dois neste mês.')).toBeTruthy()
    expect(screen.getByText('Nenhum treino neste mês.')).toBeTruthy()
  })

  it('mostra o erro na tela se a imagem falhar', async () => {
    const { buildSummaryCard } = jest.requireMock('@/lib/summaryCard')
    buildSummaryCard.mockRejectedValueOnce(new Error('sem memória'))
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    seedCouple()
    await open('/compartilhar')
    await press((await screen.findAllByText('📤 Compartilhar story'))[0])
    expect(await screen.findByText('Não consegui compartilhar: sem memória')).toBeTruthy()
  })
})

describe('Exceção com resposta do parceiro', () => {
  const pending = (over: Record<string, unknown> = {}) => ({
    id: 'e1',
    group_id: 'g1',
    user_id: 'u2',
    day: '2026-11-19',
    reason: 'doenca',
    note: 'Gripe',
    created_at: '2026-11-18T14:00:00Z', // hoje, 11h em Brasília
    reviewed_by: null,
    reviewed_at: null,
    ...over,
  })

  it('o parceiro recusa no Início e o feed mostra a recusa', async () => {
    const fake = seedCouple()
    fake.db.exceptions = [pending()]
    await open('/')
    expect(await screen.findByText('Exceção esperando a sua resposta')).toBeTruthy()
    await press(screen.getAllByText('✕ Recusar')[0])
    await type(await screen.findByLabelText('Motivo (opcional)'), 'Te vi na academia')
    await press(screen.getByText('Recusar exceção'))
    await waitFor(() => expect(fake.db.exceptions).toHaveLength(0))
    expect(fake.db.exception_rejections[0]).toMatchObject({ author_id: 'u2', rejected_by: 'u1', why: 'Te vi na academia' })

    await open('/feed')
    expect(await screen.findByText(/Motivo: “Te vi na academia”/)).toBeTruthy()

    // Ana não consegue marcar o mesmo dia de novo.
    fake.login('u2', 'Ana')
    await open('/excecoes')
    await press(await screen.findByText('19/11'))
    await tap('Doença')
    await tap('Marcar exceção')
    expect((await screen.findAllByText(/recusou a exceção desse dia/)).length).toBeGreaterThan(0)
    expect(fake.db.exceptions).toHaveLength(0)
  })

  it('aprova; quem marcou vê "aguardando"; depois do dia não dá mais para responder', async () => {
    const fake = seedCouple()
    fake.db.exceptions = [pending()]
    await open('/excecoes')
    await press((await screen.findAllByText('✓ Aprovar'))[0])
    await waitFor(() => expect(fake.db.exceptions[0].reviewed_by).toBe('u1'))
    expect(await screen.findByText('✓ Aprovada por Rafael')).toBeTruthy()

    // Exceção minha, marcada hoje: espera o parceiro.
    fake.db.exceptions = [pending({ id: 'e2', user_id: 'u1' })]
    await open('/excecoes')
    expect(await screen.findByText(/Aguardando o parceiro até 23h59/)).toBeTruthy()

    // Marcada ontem: o prazo acabou e ela vale.
    fake.db.exceptions = [pending({ id: 'e3', created_at: '2026-11-17T14:00:00Z' })]
    await open('/excecoes')
    expect(await screen.findByText(/Ana/)).toBeTruthy()
    expect(screen.queryByText('✕ Recusar')).toBeNull()
  })
})

describe('Roleta de prêmios', () => {
  it('ganha um giro com 2 semanas seguidas, gira e marca como aproveitado', async () => {
    const fake = seedCouple()
    const met = (week_start: string, user_id: string) => ({ ...fake.db.week_results[0], week_id: 'w-' + week_start, week_start, user_id, met: true, owes: false })
    fake.db.week_results.push(met('2026-10-26', 'u1'), met('2026-10-26', 'u2'), met('2026-11-02', 'u1'), met('2026-11-02', 'u2'))
    await open('/')
    await press(await screen.findByText('🎁 Vocês ganharam um giro na roleta de prêmios!'))
    expect(await screen.findByText('Vocês ganharam um giro!')).toBeTruthy()
    await press(screen.getByText('🎰 Girar a roleta'))
    expect(await screen.findByText('Vocês ganharam')).toBeTruthy()
    // Só o prêmio ativo pode sair.
    expect(fake.db.reward_spins[0]).toMatchObject({ week_start: '2026-11-02', reward_text: 'Massagem de 20 minutos', spun_by: 'u1' })

    await press(await screen.findByText('Marcar aproveitado'))
    expect(await screen.findByText('✓ Aproveitado')).toBeTruthy()
    expect(fake.db.reward_spins[0].redeemed_at).toBeTruthy()
  })

  it('sem giro mostra quanto falta e deixa cadastrar prêmio', async () => {
    const fake = seedCouple()
    await open('/premios')
    expect(await screen.findByText('Faltam 2 semanas para o próximo giro')).toBeTruthy()
    await press(screen.getByText('+ Novo'))
    await type(await screen.findByLabelText('Prêmio'), 'Jantar japonês')
    await tap('Salvar')
    expect(await screen.findByText('Jantar japonês')).toBeTruthy()
    expect(fake.db.rewards.at(-1)).toMatchObject({ description: 'Jantar japonês', group_id: 'g1' })
  })
})

describe('Planejar a semana e "vamos?"', () => {
  it('marca o dia e o período, aparece no Início, e chama o parceiro', async () => {
    const fake = seedCouple()
    await open('/planejar')
    await press(await screen.findByLabelText('Vou treinar 18/11'))
    await waitFor(() => expect(fake.db.workout_plans).toHaveLength(1))
    await press(await screen.findByLabelText('Tarde 18/11'))
    await waitFor(() => expect(fake.db.workout_plans[0]).toMatchObject({ user_id: 'u1', day: '2026-11-18', period: 'tarde' }))

    await open('/')
    expect(await screen.findByText('Você: Tarde')).toBeTruthy()
    expect(screen.getByText('Ana: Sem plano')).toBeTruthy()
    await press(screen.getByText('💪 Vamos?'))
    await waitFor(() => expect(fake.db.nudges).toHaveLength(1))
    expect(fake.db.nudges[0]).toMatchObject({ from_user: 'u1', to_user: 'u2' })
  })

  it('mostra o "vamos?" recebido e some depois de responder', async () => {
    const fake = seedCouple()
    fake.db.nudges = [{ id: 'n1', group_id: 'g1', from_user: 'u2', to_user: 'u1', created_at: '2026-11-18T14:30:00Z', seen_at: null }]
    await open('/')
    expect(await screen.findByText('💪 Ana chamou: bora treinar?')).toBeTruthy()
    await press(screen.getByText('Agora não'))
    await waitFor(() => expect(fake.db.nudges[0].seen_at).toBeTruthy())
    await waitFor(() => expect(screen.queryByText('💪 Ana chamou: bora treinar?')).toBeNull())
  })

  it('antes da atualização do banco, o Início abre normal e as telas novas avisam', async () => {
    const fake = seedCouple()
    for (const t of ['workout_plans', 'nudges', 'rewards', 'reward_spins', 'exception_rejections', 'monthly_challenges', 'evolution_photos']) fake.missingTables.add(t)
    await open('/')
    expect(await screen.findByText('Faltam 2 em 4 dias')).toBeTruthy()
    expect(screen.queryByText('Plano de hoje')).toBeNull()
    await open('/premios')
    expect(await screen.findByText(/depois que a atualização do banco for aplicada/)).toBeTruthy()
  })
})

describe('Limite mensal de exceções', () => {
  it('avisa quantas restam e trava no limite; o limite muda nas regras do grupo', async () => {
    const fake = seedCouple()
    fake.db.groups[0].exceptions_per_month = 1
    fake.db.exceptions = [
      { id: 'x1', group_id: 'g1', user_id: 'u1', day: '2026-11-20', reason: 'viagem', note: null, created_at: '2026-11-17T12:00:00Z', reviewed_by: 'u2', reviewed_at: '2026-11-17T13:00:00Z' },
    ]
    await open('/excecoes')
    await press(await screen.findByText('19/11'))
    expect(await screen.findByText('Você já usou a única exceção de novembro.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Marcar exceção' })).toBeDisabled()

    await open('/grupo')
    await type(await screen.findByLabelText('Exceções por pessoa no mês'), '3')
    await tap('Salvar regras')
    await waitFor(() => expect(fake.db.groups[0].exceptions_per_month).toBe(3))
  })

  it('mostra quantas restam no mês', async () => {
    seedCouple()
    await open('/excecoes')
    await press(await screen.findByText('19/11'))
    expect(await screen.findByText('Restam 4 de 4 exceções em novembro.')).toBeTruthy()
  })
})

describe('Desafio do mês', () => {
  it('cria pela sugestão, acompanha, cumpre e ganha um giro', async () => {
    const fake = seedCouple()
    fake.db.checkins[0].kind = 'cardio'
    await open('/desafio')
    await press(await screen.findByLabelText('Criar Mês do cardio em Novembro de 2026'))
    await waitFor(() => expect(fake.db.monthly_challenges[0]).toMatchObject({ month: '2026-11-01', kind: 'cardio', target: 8, created_by: 'u1' }))
    expect(await screen.findByText('1 de 8')).toBeTruthy()

    await press(screen.getAllByText('Editar')[0])
    // O primeiro formulário é o deste mês (o do próximo mês fica embaixo).
    await type((await screen.findAllByLabelText('Quantos no mês (somando os dois)'))[0], '1')
    await tap('Salvar')
    expect(await screen.findByText(/Cumprido!/)).toBeTruthy()

    await press(screen.getByText('🎁 Girar a roleta de prêmios'))
    expect(await screen.findByText('Desafio cumprido: Mês do cardio')).toBeTruthy()
    await press(screen.getByText('🎰 Girar a roleta'))
    await waitFor(() => expect(fake.db.reward_spins[0]).toMatchObject({ challenge_id: fake.db.monthly_challenges[0].id, week_start: null }))

    // Depois do giro, o desafio fica travado.
    await open('/desafio')
    expect(await screen.findByText('🎁 Giro de prêmio já usado')).toBeTruthy()
    expect(screen.queryByText('Apagar desafio')).toBeNull()

    await open('/')
    expect(await screen.findByText(/Mês do cardio: 1\/1/)).toBeTruthy()
  })
})

describe('Fotos de evolução', () => {
  it('pede ciência, guarda a foto privada e mostra as do parceiro que ele escolheu mostrar', async () => {
    const fake = seedCouple()
    fake.db.evolution_photos = [
      { id: 'ev-ana', user_id: 'u2', group_id: 'g1', photo_path: 'u2/a.jpg', taken_on: '2026-11-10', weight_kg: 60, note: null, shared: true, created_at: '2026-11-10T12:00:00Z' },
    ]
    await open('/evolucao')
    await press(await screen.findByText('Entendi, quero usar'))
    await press(await screen.findByText('📷 Adicionar foto'))
    await press(await screen.findByText('🖼️ Da galeria'))
    await type(await screen.findByLabelText('Peso em kg (opcional)'), '72,5')
    await press(screen.getByText('Guardar foto'))
    await waitFor(() =>
      expect(fake.db.evolution_photos.find((p) => p.user_id === 'u1')).toMatchObject({ taken_on: '2026-11-18', weight_kg: 72.5, shared: false }),
    )
    expect(fake.uploads.some((u) => u.startsWith('u1/'))).toBe(true)
    expect(await screen.findByText('Mostradas por Ana')).toBeTruthy()
  })

  it('recusa data no futuro', async () => {
    seedCouple()
    await open('/evolucao')
    // A ciência fica salva no aparelho: pode já ter sido dada no teste anterior.
    await screen.findByText(/Entendi, quero usar|Adicionar foto/)
    const consent = screen.queryByText('Entendi, quero usar')
    if (consent) await press(consent)
    await press(await screen.findByText('📷 Adicionar foto'))
    await press(await screen.findByText('📷 Tirar agora'))
    await type(await screen.findByLabelText('Data da foto (DD/MM/AAAA)'), '25/12/2026')
    await press(screen.getByText('Guardar foto'))
    expect((await screen.findAllByText('A data não pode ser no futuro')).length).toBeGreaterThan(0)
  })
})

describe('Exportar meus dados', () => {
  it('monta o arquivo só com os dados da pessoa e abre o compartilhar', async () => {
    const { shareTextFile } = jest.requireMock('@/lib/shareFile')
    shareTextFile.mockClear()
    seedCouple()
    await open('/mais')
    await press(await screen.findByText('📦 Exportar meus dados'))
    await waitFor(() => expect(shareTextFile).toHaveBeenCalledTimes(1))
    const [name, text, mime] = shareTextFile.mock.calls[0]
    expect(name).toBe('treino-a-dois-meus-dados.json')
    expect(mime).toBe('application/json')
    const data = JSON.parse(text)
    expect(data.conta).toMatchObject({ id: 'u1', nome: 'Rafael' })
    expect(data.grupos).toEqual([expect.objectContaining({ id: 'g1', name: 'Nós dois', papel: 'owner' })])
    // Só os treinos do Rafael (c1 e c2), não o da Ana.
    expect(data.treinos.map((t: { id: string }) => t.id).sort()).toEqual(['c1', 'c2'])
    expect(data.semanas).toEqual([expect.objectContaining({ week_start: '2026-11-09', met: true })])
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
