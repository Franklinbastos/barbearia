// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoDeConfirmacao } from './botao-de-confirmacao';

const props = {
  rotulo: 'Cancelar meu horário',
  rotuloConfirmar: 'Confirmar cancelamento',
  aoConfirmar: vi.fn(),
};

describe('BotaoDeConfirmacao', () => {
  it('o primeiro clique não executa, só arma', async () => {
    const aoConfirmar = vi.fn();
    render(<BotaoDeConfirmacao {...props} aoConfirmar={aoConfirmar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar meu horário' }));
    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar cancelamento' })).toBeDefined();
  });

  it('o segundo clique executa', async () => {
    const aoConfirmar = vi.fn();
    render(<BotaoDeConfirmacao {...props} aoConfirmar={aoConfirmar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar meu horário' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(aoConfirmar).toHaveBeenCalledOnce();
  });

  it('volta sozinho ao rótulo original depois do tempo', async () => {
    // `shouldAdvanceTime` porque a @testing-library só sabe adiantar relógio
    // falso quando existe um `jest` global — sem ele o `await` do clique nunca
    // resolve. O `act` é o que faz o React aplicar o estado que o timeout mudou.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<BotaoDeConfirmacao {...props} segundos={4} />);
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await u.click(screen.getByRole('button', { name: 'Cancelar meu horário' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    expect(screen.getByRole('button', { name: 'Cancelar meu horário' })).toBeDefined();
    vi.useRealTimers();
  });

  it('quando pendente, não executa de novo', async () => {
    const aoConfirmar = vi.fn();
    render(<BotaoDeConfirmacao {...props} aoConfirmar={aoConfirmar} pendente />);
    await userEvent.click(screen.getByRole('button'));
    expect(aoConfirmar).not.toHaveBeenCalled();
  });
});
