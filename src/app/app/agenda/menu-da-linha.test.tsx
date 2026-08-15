// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuDaLinha } from './menu-da-linha';
import type { AgendaItem } from './day-grid';

const ITEM: AgendaItem = {
  id: 'a1',
  staffId: 's1',
  customerId: 'c1',
  staffName: 'Marcão',
  customerName: 'Marcos',
  customerPhone: '(11) 99999-8888',
  serviceName: 'Corte',
  servicePriceCents: 5000,
  status: 'BOOKED',
  origin: 'PUBLIC',
  startAt: new Date('2026-08-14T13:00:00Z'),
  endAt: new Date('2026-08-14T13:30:00Z'),
};

const PADRAO = {
  pendente: false,
  onMarcar: () => {},
  // 20 minutos depois do início: o "Não veio" já pode aparecer.
  agora: new Date('2026-08-14T13:20:00Z'),
};

function montar(props: Partial<React.ComponentProps<typeof MenuDaLinha>> = {}) {
  return render(<MenuDaLinha item={ITEM} {...PADRAO} {...props} />);
}

/** Abre o menu pelo teclado, que é o percurso que este arquivo existe para servir. */
async function abrirPeloTeclado(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole('button', { name: /Mais ações/ }).focus();
  await user.keyboard('{Enter}');
  await screen.findByRole('menu');
}

describe('MenuDaLinha', () => {
  it('marca "Compareceu" pelo teclado, sem mouse nenhum', async () => {
    // É a razão de o arquivo existir. Na linha os dois verbos recolhem e só
    // sobem no ponteiro; o Polaris exige um segundo caminho, e o segundo
    // caminho é este. A primeira versão deste menu punha um <button> dentro do
    // <div role="menuitem"> do base-ui: o item aparecia na tela, as setas
    // andavam por ele, e o Enter não marcava ninguém.
    const onMarcar = vi.fn();
    const user = userEvent.setup();
    montar({ onMarcar });

    // Abrir com Enter já realça o primeiro item; o segundo Enter o dispara.
    await abrirPeloTeclado(user);
    await user.keyboard('{Enter}');

    expect(onMarcar).toHaveBeenCalledWith('DONE');
  });

  it('marca "Não veio" pelo teclado', async () => {
    const onMarcar = vi.fn();
    const user = userEvent.setup();
    montar({ onMarcar });

    await abrirPeloTeclado(user);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onMarcar).toHaveBeenCalledWith('NO_SHOW');
  });

  it('leva os sete itens da linha', async () => {
    const user = userEvent.setup();
    montar();
    await abrirPeloTeclado(user);

    const nomes = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(nomes).toEqual([
      'Compareceu',
      'Não veio',
      'Remarcar',
      'Abrir no WhatsApp',
      'Ver ficha do cliente',
      'Ligar para o cliente',
      'Cancelar',
    ]);
  });

  it('nomeia o cliente no rótulo do "⋯"', async () => {
    // Num dia de vinte atendimentos, vinte botões "Mais ações" idênticos não
    // dizem nada a quem usa leitor de tela. A frase é a mesma do `⋯` do cartão
    // do celular: é a mesma afordância, em duas telas.
    montar();
    expect(screen.getByRole('button', { name: 'Mais ações para Marcos' })).not.toBeNull();
  });

  it('o WhatsApp leva o 55 do país, e não só os dígitos', async () => {
    // `wa.me/11999998888` abre conversa vazia e nada na tela avisa. Quem põe o
    // 55 é `telefoneParaWaMe`, em `src/lib/telefone.ts` — uma só no produto.
    const user = userEvent.setup();
    montar();
    await abrirPeloTeclado(user);

    expect(screen.getByRole('menuitem', { name: /Abrir no WhatsApp/ }).getAttribute('href')).toBe(
      'https://wa.me/5511999998888',
    );
  });

  it('a ficha do cliente leva ao customerId', async () => {
    const user = userEvent.setup();
    montar();
    await abrirPeloTeclado(user);

    expect(
      screen.getByRole('menuitem', { name: /Ver ficha do cliente/ }).getAttribute('href'),
    ).toBe('/app/clientes/c1');
  });

  it('"Cancelar" pede a segunda batida antes de cancelar', async () => {
    const onMarcar = vi.fn();
    const user = userEvent.setup();
    montar({ onMarcar });
    await abrirPeloTeclado(user);

    await user.click(screen.getByRole('menuitem', { name: 'Cancelar' }));
    expect(onMarcar).not.toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: 'Confirmar cancelamento' }));
    expect(onMarcar).toHaveBeenCalledWith('CANCELED');
  });

  it('"Remarcar" nasce desabilitado enquanto não há para onde remarcar', async () => {
    // A Task 4 passa o `onRemarcar` e o item liga sozinho.
    const user = userEvent.setup();
    montar();
    await abrirPeloTeclado(user);

    const remarcar = screen.getByRole('menuitem', { name: 'Remarcar' });
    expect(remarcar.getAttribute('aria-disabled')).toBe('true');
  });

  it('o cancelado mantém os caminhos para falar com o cliente, e só eles', async () => {
    const user = userEvent.setup();
    montar({ item: { ...ITEM, status: 'CANCELED' } });
    await abrirPeloTeclado(user);

    const nomes = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(nomes).toEqual(['Abrir no WhatsApp', 'Ver ficha do cliente', 'Ligar para o cliente']);
  });

  it('esconde o "Não veio" antes dos dez minutos, como o resto do produto', async () => {
    const user = userEvent.setup();
    montar({ agora: new Date('2026-08-14T13:05:00Z') });
    await abrirPeloTeclado(user);

    expect(screen.queryByRole('menuitem', { name: 'Não veio' })).toBeNull();
  });
});
