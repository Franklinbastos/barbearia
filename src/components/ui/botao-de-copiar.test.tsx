// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('avisa que copiou, e o ícone vira ✓', async () => {
    // Polaris: "Provide feedback inline using a confirmation check icon
    // post-click". Sem retorno, a pessoa clica de novo achando que falhou.
    const usuario = userEvent.setup();
    const { container } = render(<BotaoDeCopiar texto={TEXTO} oQue="o link" />);

    expect(container.querySelector('[data-slot="copiar-feito"]')).toBeNull();
    await usuario.click(screen.getByRole('button', { name: 'Copiar o link' }));

    expect(screen.getByRole('status').textContent).toMatch(/copiad/i);
    expect(container.querySelector('[data-slot="copiar-feito"]')).not.toBeNull();
  });

  it('a região de aviso existe antes do clique', () => {
    // Região viva que nasce já preenchida costuma não ser anunciada.
    render(<BotaoDeCopiar texto={TEXTO} oQue="o link" />);
    expect(screen.getByRole('status').textContent).toBe('');
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

  it('pode dispensar o aviso próprio quando quem chama já tem um', () => {
    render(<BotaoDeCopiar texto={TEXTO} oQue="o link" aviso="nenhum" />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
