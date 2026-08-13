// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TiraDeDias, type DiaDaTira } from './tira-de-dias';

const dia = (iso: string, rotulo: string, numero: string, situacao: DiaDaTira['situacao']) => ({
  iso,
  rotulo,
  numero,
  situacao,
});

const DIAS: DiaDaTira[] = [
  dia('2026-08-13', 'HOJE', '13', 'livre'),
  dia('2026-08-14', 'AMANHÃ', '14', 'cheio'),
  dia('2026-08-15', 'SEX', '15', 'desconhecido'),
];

function montar(selecionado = '2026-08-13') {
  return render(
    <TiraDeDias
      dias={DIAS}
      selecionado={selecionado}
      aoSelecionar={vi.fn()}
      maxIso="2026-09-07"
    />,
  );
}

describe('TiraDeDias', () => {
  it('é grade de 7 colunas e não rola de lado — o gesto que mais se erra em pé', () => {
    const { container } = montar();
    const raiz = container.querySelector('[data-slot="tira-de-dias"]');
    expect(raiz?.className).toMatch(/grid-cols-7/);
    expect(raiz?.className ?? '').not.toMatch(/overflow-x/);
  });

  it('o dia escolhido é o único com aria-pressed', () => {
    montar('2026-08-14');
    expect(screen.getByRole('button', { name: /AMANHÃ/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /HOJE/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('o ponto de 4px existe em todo dia, para nada saltar quando /days responde', () => {
    const { container } = montar();
    const pontos = container.querySelectorAll('[data-slot="tira-ponto"]');
    expect(pontos).toHaveLength(DIAS.length);
    for (const ponto of pontos) expect(ponto.className).toMatch(/h-1 w-1/);
  });

  it('a cor do ponto conta a situação do dia', () => {
    const { container } = montar('2026-08-13');
    const [hoje, amanha, sexta] = Array.from(
      container.querySelectorAll('[data-slot="tira-ponto"]'),
    ).map((n) => n.className);
    // livre + marcado ⇒ contrasta com o fundo da marca
    expect(hoje).toMatch(/bg-\[var\(--sobre-marca\)\]/);
    // cheio ⇒ sem ponto; o número acinzentado já conta
    expect(amanha).toMatch(/bg-transparent/);
    // ainda não sei ⇒ cinza de separação
    expect(sexta).toMatch(/bg-linha-suave/);
  });

  it('dia cheio não é só cor: o leitor de tela ouve "sem vaga"', () => {
    montar();
    // Sem espaço entre os pedaços: o jsdom não tem CSS, e o nome acessível sai
    // da concatenação crua dos três `<span>`.
    expect(screen.getByRole('button', { name: /AMANHÃ\s*14\s*sem vaga/ })).toBeDefined();
  });

  it('"Outro dia" escreve o limite e o input carrega min e max', () => {
    const { container } = montar();
    expect(screen.getByText(/Outro dia \(até 7 de set\)/)).toBeDefined();
    const data = container.querySelector('input[type="date"]');
    expect(data?.getAttribute('min')).toBe('2026-08-13');
    expect(data?.getAttribute('max')).toBe('2026-09-07');
  });

  it('aceita className de fora sem perder a grade', () => {
    const { container } = render(
      <TiraDeDias
        dias={DIAS}
        selecionado="2026-08-13"
        aoSelecionar={vi.fn()}
        maxIso="2026-09-07"
        className="mt-8"
      />,
    );
    const raiz = container.querySelector('[data-slot="tira-de-dias"]');
    expect(raiz?.className).toMatch(/mt-8/);
    expect(raiz?.className).toMatch(/grid-cols-7/);
  });
});
