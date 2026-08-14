// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { PerfilDoCliente } from '@/domain/indicadores/perfil-do-cliente';
import { IndicadoresDoCliente } from './indicadores-do-cliente';

/**
 * A regra que a spec mais defende: **número sem base vira traço, nunca zero**.
 * "0% de falta" e "nunca teve chance de faltar" são coisas diferentes, e a ficha
 * é justamente onde o dono olha antes de cobrar sinal de alguém.
 */

const TZ = 'America/Sao_Paulo';

const BASE: PerfilDoCliente = {
  totalGastoCents: 25_000,
  atendimentos: 5,
  intervaloTipico: 15,
  ultimaVisita: new Date('2026-07-13T01:00:00Z'),
  diasSemVir: 33,
  taxaDeFalta: 0.2,
  faltas: 1,
  servicoPreferido: 'Corte',
  barbeiroPreferido: 'Marcão',
  sumido: true,
};

function perfil(over: Partial<PerfilDoCliente> = {}): PerfilDoCliente {
  return { ...BASE, ...over };
}

describe('IndicadoresDoCliente', () => {
  const tzOriginal = process.env.TZ;
  // O servidor da Vercel roda em UTC: é aí que a data sem fuso sai errada.
  beforeAll(() => {
    process.env.TZ = 'UTC';
  });
  afterAll(() => {
    process.env.TZ = tzOriginal;
  });

  it('mostra os quatro cartões', () => {
    render(<IndicadoresDoCliente perfil={BASE} timeZone={TZ} />);
    expect(screen.getByText('R$ 250,00')).toBeTruthy();
    expect(screen.getByText('em 5 atendimentos')).toBeTruthy();
    expect(screen.getByText(/15 dias/)).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.getByText('Corte')).toBeTruthy();
    expect(screen.getByText('com Marcão')).toBeTruthy();
  });

  it('sem base, o número vira traço — nunca zero', () => {
    render(
      <IndicadoresDoCliente
        perfil={perfil({ taxaDeFalta: null, faltas: 0, intervaloTipico: null })}
        timeZone={TZ}
      />,
    );
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getAllByText('—').length).toBe(2);
  });

  it('zero por cento continua sendo zero: o traço é só para quem não tem base', () => {
    // Quem marcou seis horários e veio nos seis merece o 0%: ele teve chance de
    // faltar e não faltou. Trocar isso por traço apagaria a informação.
    render(<IndicadoresDoCliente perfil={perfil({ taxaDeFalta: 0, faltas: 0 })} timeZone={TZ} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('quem nunca gastou nada mostra R$ 0,00, e não "Grátis"', () => {
    // `formatPrice` devolve "Grátis" no zero — certo para preço de serviço,
    // absurdo em "total gasto". Por isso o cartão usa `formatMoney`.
    render(
      <IndicadoresDoCliente
        perfil={perfil({ totalGastoCents: 0, atendimentos: 0 })}
        timeZone={TZ}
      />,
    );
    expect(screen.getByText('R$ 0,00')).toBeTruthy();
    expect(screen.queryByText('Grátis')).toBeNull();
  });

  it('a última visita sai no fuso da barbearia', () => {
    // 12/07 às 22:00 em São Paulo é 13/07 em UTC. Ler pelo fuso do servidor
    // envelheceria a visita em um dia.
    render(<IndicadoresDoCliente perfil={BASE} timeZone={TZ} />);
    expect(screen.getByText('última visita em 12 de julho')).toBeTruthy();
  });

  it('quem nunca veio não ganha data de última visita', () => {
    render(
      <IndicadoresDoCliente
        perfil={perfil({ ultimaVisita: null, diasSemVir: null, intervaloTipico: null })}
        timeZone={TZ}
      />,
    );
    expect(screen.getByText('Ainda não veio')).toBeTruthy();
  });

  it('todo cartão explica como o número sai', () => {
    // o `explicacao` do CartaoIndicador é obrigatório de propósito: "corta a
    // cada 15 dias" sem dizer que é mediana não é número em que o dono confia
    const { container } = render(<IndicadoresDoCliente perfil={BASE} timeZone={TZ} />);
    const cartoes = container.querySelectorAll('[data-slot="cartao-indicador"]');
    expect(cartoes.length).toBe(4);
    cartoes.forEach((cartao) => {
      expect(cartao.querySelector('[data-slot="cartao-indicador-explicacao"]')).not.toBeNull();
    });
    // O alvo é um botão de verdade, com nome acessível — quem navega por teclado
    // chega nele.
    expect(screen.getAllByRole('button', { name: /é calculado/i }).length).toBe(4);
  });
});
