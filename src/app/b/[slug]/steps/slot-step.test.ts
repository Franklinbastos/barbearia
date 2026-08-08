import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlotStep } from './slot-step';
import { isoDateInZone } from '@/lib/format';

const TZ = 'America/Sao_Paulo';
const HOJE = isoDateInZone(new Date(), TZ);
const DEPOIS = new Date(new Date(`${HOJE}T12:00:00Z`).getTime() + 3 * 86_400_000)
  .toISOString()
  .slice(0, 10);

function render(dia: string, maxAdvanceDays = 5) {
  return renderToStaticMarkup(
    createElement(SlotStep, {
      slug: 'barbearia-x',
      serviceId: 'srv-1',
      timeZone: TZ,
      maxAdvanceDays,
      dia,
      aoTrocarDia: vi.fn(),
      telefoneDaLoja: null,
      onSelect: vi.fn(),
      onVoltar: vi.fn(),
    }),
  );
}

const botoesDeDia = (html: string) => html.match(/<button[^>]*aria-pressed[^>]*>/g) ?? [];

describe('SlotStep — tira de dias', () => {
  it('anuncia qual dia está escolhido, e não só engrossa a fonte', () => {
    const botoes = botoesDeDia(render(HOJE));
    // hoje + `maxAdvanceDays`, que é a mesma conta de `bookingWindowLimit`.
    expect(botoes).toHaveLength(6);
    expect(botoes.filter((b) => b.includes('aria-pressed="true"'))).toHaveLength(1);
    expect(botoes.filter((b) => b.includes('aria-pressed="false"'))).toHaveLength(5);
  });

  it('o dia marcado é o que veio por prop, não o primeiro da tira', () => {
    // A regressão que isto trava: com o dia em `useState` dentro do passo, o
    // retorno do 409 remontava o componente em "hoje" e o cliente perdia a
    // sexta que tinha escolhido.
    const botoes = botoesDeDia(render(DEPOIS));
    expect(botoes[0]).toContain('aria-pressed="false"');
    expect(botoes[3]).toContain('aria-pressed="true"');
  });

  it('nunca passa de 14 fichas, por maior que seja a janela da loja', () => {
    expect(botoesDeDia(render(HOJE, 60))).toHaveLength(14);
  });

  it('a tira é grade e não rola de lado', () => {
    const html = render(HOJE);
    expect(html).toContain('grid-cols-7');
    expect(html).not.toContain('overflow-x');
  });
});
