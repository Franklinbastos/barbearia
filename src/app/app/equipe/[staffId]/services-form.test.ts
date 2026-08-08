import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServicesForm, rotuloDaDuracaoPropria } from './services-form';

describe('rotuloDaDuracaoPropria', () => {
  it('diz de qual serviço é a duração', () => {
    expect(rotuloDaDuracaoPropria('Corte simples')).toContain('Corte simples');
  });

  it('contém o rótulo visível, senão o nome acessível briga com o que está escrito', () => {
    expect(rotuloDaDuracaoPropria('Barba')).toContain('Duração própria (min)');
  });

  it('dá nome distinto a cada linha', () => {
    expect(rotuloDaDuracaoPropria('Corte')).not.toBe(rotuloDaDuracaoPropria('Barba'));
  });
});

describe('ServicesForm', () => {
  const html = renderToStaticMarkup(
    createElement(ServicesForm, {
      staffId: 'st-1',
      servicos: [
        { id: 's1', name: 'Corte simples', durationMinutes: 30 },
        { id: 's2', name: 'Barba', durationMinutes: 20 },
      ],
      selecionados: new Map<string, number | null>([['s1', 45]]),
    }),
  );

  it('todo campo de duração tem nome acessível próprio', () => {
    expect(html).toContain(`aria-label="${rotuloDaDuracaoPropria('Corte simples')}"`);
    expect(html).toContain(`aria-label="${rotuloDaDuracaoPropria('Barba')}"`);
  });

  it('mantém a marcação e a duração própria que já estavam salvas', () => {
    const caixas = html.match(/<input[^>]*name="serviceIds"[^>]*>/g) ?? [];
    expect(caixas).toHaveLength(2);
    expect(caixas[0]).toContain('value="s1"');
    expect(caixas[0]).toContain('checked');
    expect(caixas[1]).toContain('value="s2"');
    expect(caixas[1]).not.toContain('checked');
    expect(html).toMatch(/name="duration_s1"[^>]*value="45"/);
  });

  it('não empilha campo e caixa de seleção numa linha de flex inline', () => {
    expect(html).not.toMatch(/style="[^"]*display:flex/);
  });
});
