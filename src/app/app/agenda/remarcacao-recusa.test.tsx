// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';

/**
 * Recusa na remarcação (decisão de 19/09/2026): qualquer recusa — bloqueio do
 * barbeiro ou horário tomado — oferece "Escolher outro horário", que fecha a
 * folha e **mantém o modo ligado**, para o próximo clique numa faixa remarcar.
 */
const MENSAGEM = 'O barbeiro já tem atendimento ou bloqueio nesse horário';

vi.mock('./actions', () => ({
  rescheduleAppointmentAction: vi.fn(async () => ({ erro: MENSAGEM })),
}));

import { Remarcacao, assinarRemarcacao, type RemarcacaoContexto } from './remarcacao';
import { pedirEncaixe } from './vao-livre';

function contextoAtual(): RemarcacaoContexto {
  let visto!: RemarcacaoContexto;
  assinarRemarcacao((c) => {
    visto = c;
  })();
  return visto;
}

afterEach(() => {
  act(() => contextoAtual().sair());
});

describe('remarcação recusada', () => {
  it('mostra a recusa e oferece escolher outro horário sem sair do modo', async () => {
    render(
      <Remarcacao dataISO="2026-09-09" timeZone="America/Sao_Paulo" nomePorStaff={new Map([['st-1', 'Pedro']])} />,
    );
    act(() => contextoAtual().entrar('appt-1', 'Marcos'));
    act(() => pedirEncaixe({ hora: '12:00', staffId: 'st-1' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar remarcação' }));

    expect(await screen.findByText(MENSAGEM)).toBeTruthy();
    const escolherOutro = screen.getByRole('button', { name: 'Escolher outro horário' });

    await userEvent.click(escolherOutro);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar remarcação' })).toBeNull());
    // O modo continua: o aviso segue na tela e o atendimento ainda é o escolhido.
    expect(contextoAtual().appointmentId).toBe('appt-1');
    expect(screen.getByRole('button', { name: 'Desistir' })).toBeTruthy();
  });

  it('sem recusa, o botão não aparece', async () => {
    render(
      <Remarcacao dataISO="2026-09-09" timeZone="America/Sao_Paulo" nomePorStaff={new Map([['st-1', 'Pedro']])} />,
    );
    act(() => contextoAtual().entrar('appt-1', 'Marcos'));
    act(() => pedirEncaixe({ hora: '12:00', staffId: 'st-1' }));

    await screen.findByRole('button', { name: 'Confirmar remarcação' });
    expect(screen.queryByRole('button', { name: 'Escolher outro horário' })).toBeNull();
  });
});
