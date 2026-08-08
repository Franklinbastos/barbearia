// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicoForm } from './servico-form';

describe('ServicoForm', () => {
  it('nasce recolhido: só o convite de 52px aparece', () => {
    render(<ServicoForm />);
    expect(screen.getByRole('button', { name: 'Adicionar serviço' })).toBeDefined();
    expect(screen.queryByLabelText('Nome')).toBeNull();
  });

  it('expandido, mostra os três campos com rótulo de verdade', async () => {
    const user = userEvent.setup();
    render(<ServicoForm />);
    await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));

    expect(screen.getByLabelText('Nome')).toBeDefined();
    expect(screen.getByLabelText('Duração (min)')).toBeDefined();
    // Regex por causa do prefixo: o "R$" é `aria-hidden`, então não entra no
    // nome acessível de verdade, mas entra no textContent que a query lê.
    expect(screen.getByLabelText(/^Preço/)).toBeDefined();
  });

  it('as fichas de 15, 30 e 45 escrevem na duração — sem roleta nativa', async () => {
    const user = userEvent.setup();
    render(<ServicoForm />);
    await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));

    const duracao = screen.getByLabelText('Duração (min)') as HTMLInputElement;
    await user.click(screen.getByRole('button', { name: '30 min' }));
    expect(duracao.value).toBe('30');

    await user.click(screen.getByRole('button', { name: '45 min' }));
    expect(duracao.value).toBe('45');
    expect(screen.getByRole('button', { name: '45 min' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('o preço tem prefixo "R$" como elemento, não como placeholder', async () => {
    const user = userEvent.setup();
    render(<ServicoForm />);
    await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));

    const preco = screen.getByLabelText(/^Preço/) as HTMLInputElement;
    expect(preco.placeholder).toBe('40,00');
    expect(preco.closest('label')?.textContent).toContain('R$');
  });

  it('fecha por "Fechar" — nunca "Cancelar", que já significa outra coisa aqui', async () => {
    const user = userEvent.setup();
    render(<ServicoForm />);
    await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));

    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByLabelText('Nome')).toBeNull();
  });
});
