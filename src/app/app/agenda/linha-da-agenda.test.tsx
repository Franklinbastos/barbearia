// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinhaDaAgenda } from './linha-da-agenda';
import type { AgendaItem } from './day-grid';

const ITEM: AgendaItem = {
  id: 'a1',
  staffId: 's1',
  customerId: 'c1',
  staffName: 'Marcão',
  customerName: 'Marcos',
  customerPhone: '11999999999',
  serviceName: 'Corte',
  servicePriceCents: 5000,
  status: 'BOOKED',
  origin: 'PUBLIC',
  startAt: new Date('2026-08-14T13:00:00Z'),
  endAt: new Date('2026-08-14T13:30:00Z'),
};

const MAIS_UMA_HORA = new Date('2026-08-14T14:00:00Z');

/** Vinte minutos depois do início: o "Não veio" já nasceu. */
const props = {
  timeZone: 'America/Sao_Paulo',
  corDoBarbeiro: 'var(--linha)',
  agora: new Date('2026-08-14T13:20:00Z'),
};

/** Monta a linha dentro da `<ol>` em que ela vive de verdade e devolve a raiz. */
function montar(item: Partial<AgendaItem> = {}) {
  const { container } = render(
    <ol className="lista">
      <LinhaDaAgenda item={{ ...ITEM, ...item }} {...props} />
    </ol>,
  );
  return container.querySelector('[data-slot="linha-da-agenda"]') as HTMLElement;
}

const colunasDe = (linha: HTMLElement) =>
  linha.querySelector('[data-slot="colunas-da-linha"]') as HTMLElement;

describe('LinhaDaAgenda', () => {
  it('não pinta o fundo por status', () => {
    // o fundo é o canal do hover (Carbon) e a cor já é do barbeiro (§3.5);
    // fundo colorido sozinho entrega 1 dos 3 portadores que o Carbon exige.
    //
    // O `style` entra na busca junto com a classe, e não é detalhe: a primeira
    // versão desta linha copiou o `peleDoEstado` do cartão e pintava
    // `background: var(--ok-bg)` inline — o teste que olhava só o `className`
    // passava com o verde na tela.
    for (const status of ['DONE', 'NO_SHOW', 'CANCELED'] as const) {
      const linha = montar({ status });
      expect(linha.className).not.toMatch(/bg-ok|bg-perigo|bg-green|bg-red/);
      expect(linha.getAttribute('style') ?? '').not.toMatch(/background/);
    }
  });

  it('o desfecho se lê sem cor nenhuma', () => {
    // contorno tracejado nos dois estados de cadeira vazia, nome riscado no
    // cancelado, etiqueta na coluna de x fixo — três portadores, que é o que o
    // Carbon exige
    expect(montar({ status: 'NO_SHOW' }).className).toMatch(/border-dashed/);
    const cancelado = montar({ status: 'CANCELED' });
    expect(cancelado.className).toMatch(/border-dashed/);
    expect(cancelado.querySelector('[data-slot="cliente-da-linha"]')?.className).toMatch(
      /line-through/,
    );
    expect(montar({ status: 'DONE' }).className).toMatch(/border-solid/);
  });

  it('a aresta continua sendo do barbeiro nos quatro estados', () => {
    // §3.5: a cor identifica quem atende. Se o desfecho pintasse a aresta, a
    // linha teria duas cores dizendo coisas diferentes no mesmo lugar.
    for (const status of ['BOOKED', 'DONE', 'NO_SHOW', 'CANCELED'] as const) {
      expect(montar({ status }).getAttribute('style')).toMatch(/border-left-color: ?var\(--linha\)/);
    }
  });

  it('todo atendimento tem a mesma altura', () => {
    // Carbon: "use the same row height … don't mix row heights". A duração
    // vira número escrito na coluna 1, não altura que ninguém mede a olho.
    const alturaDe = (item: Partial<AgendaItem>) =>
      colunasDe(montar(item)).className.match(/\bh-\d+\b/)?.[0];

    expect(alturaDe({})).toBe('h-12');
    expect(alturaDe({ id: 'b', endAt: MAIS_UMA_HORA })).toBe('h-12');
  });

  it('a duração aparece escrita', () => {
    expect(montar().textContent).toMatch(/30 min/);
    expect(montar({ id: 'b', endAt: MAIS_UMA_HORA }).textContent).toMatch(/1 h/);
  });

  it('o menu fica na linha e sempre visível', () => {
    // Carbon: "the overflow menu icons are persistent on each row"
    const menu = montar().querySelector('[data-slot="menu-da-linha"]');
    expect(menu).not.toBeNull();
    expect(menu?.className).not.toMatch(/opacity-0/);
    // O rótulo nomeia o cliente, e é a mesma frase do `⋯` do cartão do celular:
    // vinte "Mais ações" idênticos não dizem de quem é cada um.
    expect(screen.getByRole('button', { name: 'Mais ações para Marcos' })).toBeDefined();
  });

  it('os verbos recolhem por opacidade e voltam no foco', () => {
    const acoes = montar().querySelector('[data-slot="verbos-da-linha"]');
    expect(acoes?.className).toMatch(/group-focus-within/);
    expect(acoes?.className).toMatch(/group-hover/);
    // recolher é opacidade: `display:none` tiraria a ação da ordem de tabulação
    expect(acoes?.className.split(/\s+/)).not.toContain('hidden');
    expect(acoes?.className).not.toMatch(/pointer-events-none/);
  });

  it('o rótulo dos verbos diz o cliente inteiro', () => {
    // vinte botões chamados só "Compareceu" deixam quem usa leitor de tela sem
    // saber de quem é cada um
    montar();
    expect(screen.getByRole('button', { name: 'Compareceu · Marcos' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Não veio · Marcos' })).toBeDefined();
  });

  it('a coluna de ações não dança quando o "Não veio" ainda não pode aparecer', () => {
    // antes dos 10 min o lugar do botão fica reservado, senão o "Compareceu"
    // anda para a direita no meio da lista
    const cedo = montar({ startAt: new Date('2026-08-14T13:15:00Z') });
    expect(screen.queryByRole('button', { name: 'Não veio · Marcos' })).toBeNull();
    expect(cedo.querySelector('[data-slot="verbos-da-linha"]')?.children).toHaveLength(2);
  });

  it('a linha já resolvida não tem verbo nenhum', () => {
    // DONE, NO_SHOW e CANCELED não têm o que marcar: sobra o "⋯"
    const linha = montar({ status: 'DONE' });
    expect(linha.querySelector('[data-slot="verbos-da-linha"]')).toBeNull();
    expect(linha.querySelector('[data-slot="menu-da-linha"]')).not.toBeNull();
  });

  it('o telefone sai da linha', () => {
    // é ele que obriga a terceira linha de conteúdo; vive na folha e na ficha
    const linha = montar();
    expect(linha.querySelector('a[href^="tel:"]')).toBeNull();
    expect(linha.textContent).not.toContain('11999999999');
  });

  it('é um <li>: a linha mora na mesma lista que o cartão do celular', () => {
    // `<div>` solto dentro de `<ol>` é HTML inválido, perde a divisória de 1px
    // da `.lista` e some da contagem de itens do leitor de tela
    expect(montar().tagName).toBe('LI');
  });
});
