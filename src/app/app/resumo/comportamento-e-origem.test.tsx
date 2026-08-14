// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { ResumoDeComportamento } from '@/domain/indicadores/comportamento';
import { ComportamentoEOrigem, resumirOrigem } from './comportamento-e-origem';

/**
 * §3.4 do spec pede os quatro números de comportamento. A taxa de falta já
 * estava na primeira dobra; os outros três eram calculados, testados e não
 * apareciam em tela nenhuma — inclusive o de origem, que é o que responde se o
 * cliente está agendando sozinho, a pergunta que justifica o produto existir.
 */

function comportamento(over: Partial<ResumoDeComportamento> = {}): ResumoDeComportamento {
  return {
    taxaFalta: 0.1,
    taxaCancelamento: 0.2,
    agendamentos: 10,
    cancelamentoEmCimaDaHora: 3,
    porOrigem: { PUBLIC: 4, PANEL: 5, BOT: 1 },
    ...over,
  };
}

describe('resumirOrigem', () => {
  it('agendar sozinho é o que veio do link e do bot — o balcão é o contrário disso', () => {
    const r = resumirOrigem({ PUBLIC: 4, PANEL: 5, BOT: 1 });
    expect(r.fracaoSozinho).toBeCloseTo(0.5);
  });

  it('detalha os três canais, para o número não ficar sem lastro', () => {
    const r = resumirOrigem({ PUBLIC: 4, PANEL: 5, BOT: 1 });
    expect(r.detalhe).toBe('4 pelo link · 1 pelo bot · 5 no balcão');
  });

  it('sem agendamento nenhum não há fração — nulo, e não 0%', () => {
    expect(resumirOrigem({ PUBLIC: 0, PANEL: 0, BOT: 0 }).fracaoSozinho).toBeNull();
  });
});

describe('ComportamentoEOrigem', () => {
  it('põe os três números na tela: cancelamento, em cima da hora e origem', () => {
    render(<ComportamentoEOrigem comportamento={comportamento()} />);

    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('4 pelo link · 1 pelo bot · 5 no balcão')).toBeTruthy();
  });

  it('cada número explica o próprio cálculo, como manda a §5.12', () => {
    render(<ComportamentoEOrigem comportamento={comportamento()} />);
    expect(screen.getAllByRole('button', { name: /como .* é calculad/i })).toHaveLength(3);
  });

  it('denominador vazio vira traço, nunca zero por cento', () => {
    render(
      <ComportamentoEOrigem
        comportamento={comportamento({
          taxaCancelamento: null,
          agendamentos: 0,
          cancelamentoEmCimaDaHora: 0,
          porOrigem: { PUBLIC: 0, PANEL: 0, BOT: 0 },
        })}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
