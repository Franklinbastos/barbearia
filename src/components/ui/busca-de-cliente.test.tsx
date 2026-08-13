// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuscaDeCliente } from './busca-de-cliente';

/**
 * A busca mora dentro da `<FolhaInferior>` — o botão de 44×44 da barra do painel
 * é que a abre (§5.10). Nada do que vale a pena testar existe no DOM antes disso.
 */
async function abrirBusca() {
  render(<BuscaDeCliente />);
  await userEvent.click(screen.getByRole('button', { name: 'Buscar cliente' }));
  // `Buscar cliente` é o rótulo do campo E o título da folha; sem o seletor,
  // `getByLabelText` acha os dois e a busca falha por ambiguidade.
  return screen.getByLabelText('Buscar cliente', { selector: 'input' });
}

function respostaCom(clientes: unknown[]) {
  return new Response(JSON.stringify({ clientes, timeZone: 'America/Sao_Paulo' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BuscaDeCliente', () => {
  it('tem campo de busca rotulado', async () => {
    const campo = await abrirBusca();
    // `type="search"` não é enfeite: é ele que dá o "x" de limpar do aparelho e
    // o teclado de busca. A §5.10 pede os dois por extenso.
    expect(campo.getAttribute('type')).toBe('search');
    expect(campo.getAttribute('inputmode')).toBe('search');
  });

  it('não busca com menos de dois caracteres — evita varrer a base a cada tecla', async () => {
    const espia = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaCom([]));
    const campo = await abrirBusca();
    await userEvent.type(campo, 'a');
    // mais que o debounce de 250ms: se fosse disparar, já teria disparado
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(espia).not.toHaveBeenCalled();
  });

  it('mostra estado vazio quando não acha ninguém', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaCom([]));
    const campo = await abrirBusca();
    await userEvent.type(campo, 'zzz');
    expect(await screen.findByText(/nenhum cliente/i)).toBeDefined();
  });

  it('cada resultado leva a dois lugares: a ficha do cliente e o dia do próximo horário', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respostaCom([
        {
          id: 'c1',
          name: 'Marcos Silva',
          phone: '(11) 98888-7777',
          proximo: '2026-08-15T17:30:00.000Z',
        },
      ]),
    );
    const campo = await abrirBusca();
    await userEvent.type(campo, 'marcos');

    const ficha = await screen.findByRole('link', { name: /Marcos Silva/ });
    expect(ficha.getAttribute('href')).toBe('/app/clientes/c1');

    // o segundo destino da linha: o dia em que o cliente tem horário marcado
    const dia = screen.getByRole('link', { name: /14:30/ });
    expect(dia.getAttribute('href')).toBe('/app/agenda?data=2026-08-15');
  });

  it('erro de rede oferece tentar de novo', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sem rede'));
    const campo = await abrirBusca();
    await userEvent.type(campo, 'zzz');
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeDefined();
  });
});
