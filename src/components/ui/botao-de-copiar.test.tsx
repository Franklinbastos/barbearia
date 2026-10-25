// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// O toast é do sonner, que precisa de um `<Toaster />` montado para desenhar.
// Aqui interessa **que** ele foi chamado e com qual texto, não o desenho dele —
// o desenho é da lib e tem os testes dela.
const toastFalso = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastFalso }));
import userEvent from '@testing-library/user-event';
import { BotaoDeCopiar } from './botao-de-copiar';

const TEXTO = 'https://app.exemplo.com/b/barbearia-do-marcao';

describe('BotaoDeCopiar', () => {
  it('escreve o texto na área de transferência', async () => {
    // Sem mock: o `setup()` do userEvent instala uma área de transferência de
    // mentira que grava de verdade, e depois disso `navigator.clipboard` só tem
    // getter — trocá-la por um `vi.fn()` lança `TypeError`. Ler o que ficou
    // guardado testa o comportamento em vez da chamada.
    const usuario = userEvent.setup();
    render(<BotaoDeCopiar texto={TEXTO} oQue="o link" />);

    await usuario.click(screen.getByRole('button', { name: 'Copiar o link' }));

    expect(await navigator.clipboard.readText()).toBe(TEXTO);
  });

  it('o ícone vira ✓ e sai um toast', async () => {
    // Os dois, e cada um por um motivo: o ✓ é o que o Polaris pede no próprio
    // controle, e o toast é o que o dono vê sem procurar um ícone de 16px no
    // canto de um campo. É o que o `CopyableField` do Cal.com faz.
    const usuario = userEvent.setup();
    const { container } = render(<BotaoDeCopiar texto={TEXTO} oQue="o link" />);

    expect(container.querySelector('[data-slot="copiar-feito"]')).toBeNull();
    await usuario.click(screen.getByRole('button', { name: 'Copiar o link' }));

    expect(container.querySelector('[data-slot="copiar-feito"]')).not.toBeNull();
    expect(toastFalso.success).toHaveBeenCalledWith('Copiado.');
  });

  it('o ícone é o de copiar antes do clique', () => {
    const { container } = render(<BotaoDeCopiar texto={TEXTO} oQue="o link" />);
    expect(container.querySelector('[data-slot="copiar-icone"]')).not.toBeNull();
  });

  it('o nome acessível diz o que vai ser copiado', () => {
    // Numa tela com dois "Copiar", um rótulo genérico deixa quem usa leitor de
    // tela sem saber qual é qual.
    render(<BotaoDeCopiar texto="11999999999" oQue="o telefone" />);
    expect(screen.getByRole('button', { name: 'Copiar o telefone' })).toBeDefined();
  });

  it('com rótulo visível, não duplica o nome no aria-label', () => {
    render(<BotaoDeCopiar texto={TEXTO} oQue="o link" rotulo="Copiar telefone" />);
    const botao = screen.getByRole('button', { name: 'Copiar telefone' });
    expect(botao.getAttribute('aria-label')).toBeNull();
  });

  it('o ícone não fica anunciado duas vezes', () => {
    // Quem ouve recebe a notícia pelo toast, que o sonner já põe em região viva.
    const { container } = render(<BotaoDeCopiar texto={TEXTO} oQue="o link" />);
    expect(container.querySelector('[data-slot="copiar-icone"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
