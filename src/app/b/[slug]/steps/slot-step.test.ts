import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlotStep } from './slot-step';

const html = renderToStaticMarkup(
  createElement(SlotStep, {
    slug: 'barbearia-x',
    serviceId: 'srv-1',
    timeZone: 'America/Sao_Paulo',
    maxAdvanceDays: 5,
    onSelect: vi.fn(),
    onVoltar: vi.fn(),
  }),
);

describe('SlotStep — fileira de dias', () => {
  const botoesDeDia = (html.match(/<button[^>]*aria-pressed[^>]*>/g) ?? []);

  it('anuncia qual dia está escolhido, e não só engrossa a fonte', () => {
    expect(botoesDeDia).toHaveLength(5);
    expect(botoesDeDia.filter((b) => b.includes('aria-pressed="true"'))).toHaveLength(1);
    expect(botoesDeDia.filter((b) => b.includes('aria-pressed="false"'))).toHaveLength(4);
  });

  it('marca o primeiro dia como o escolhido ao abrir', () => {
    expect(botoesDeDia[0]).toContain('aria-pressed="true"');
  });
});
