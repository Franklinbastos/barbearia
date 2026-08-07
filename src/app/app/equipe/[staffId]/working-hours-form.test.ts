import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WorkingHoursForm,
  rotuloDoCampoDeHora,
  mensagemDeExpedienteSalvo,
} from './working-hours-form';

describe('rotuloDoCampoDeHora', () => {
  it('nomeia o campo com dia, extremo e bloco', () => {
    expect(rotuloDoCampoDeHora(1, 0, 'start')).toBe('Segunda — início do bloco 1');
    expect(rotuloDoCampoDeHora(1, 0, 'end')).toBe('Segunda — fim do bloco 1');
    expect(rotuloDoCampoDeHora(6, 2, 'start')).toBe('Sábado — início do bloco 3');
  });

  it('cada um dos 42 campos da tela tem rótulo distinto', () => {
    const rotulos = new Set<string>();
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      for (let bloco = 0; bloco < 3; bloco += 1) {
        rotulos.add(rotuloDoCampoDeHora(weekday, bloco, 'start'));
        rotulos.add(rotuloDoCampoDeHora(weekday, bloco, 'end'));
      }
    }
    expect(rotulos.size).toBe(42);
  });
});

describe('mensagemDeExpedienteSalvo', () => {
  it('diz qual dia foi salvo, não só "salvo"', () => {
    expect(mensagemDeExpedienteSalvo(1)).toMatch(/segunda/i);
    expect(mensagemDeExpedienteSalvo(7)).toMatch(/domingo/i);
    expect(mensagemDeExpedienteSalvo(1)).not.toBe(mensagemDeExpedienteSalvo(2));
  });
});

describe('WorkingHoursForm', () => {
  const html = renderToStaticMarkup(
    createElement(WorkingHoursForm, {
      staffId: 'st-1',
      weekday: 2,
      blocos: [{ startTime: '09:00:00', endTime: '12:00:00' }],
    }),
  );

  it('dá nome acessível a todo campo de hora', () => {
    const campos = html.match(/<input type="time"[^>]*>/g) ?? [];
    expect(campos).toHaveLength(6);
    for (const campo of campos) {
      expect(campo).toContain('aria-label="Terça —');
    }
  });

  it('distingue início de fim e um bloco do outro', () => {
    expect(html).toContain('aria-label="Terça — início do bloco 1"');
    expect(html).toContain('aria-label="Terça — fim do bloco 1"');
    expect(html).toContain('aria-label="Terça — início do bloco 3"');
  });

  it('confirma o salvamento na tela', () => {
    const fonte = readFileSync(fileURLToPath(new URL('./working-hours-form.tsx', import.meta.url)), 'utf8');
    expect(fonte).toContain('state.ok');
    expect(fonte).toContain('mensagemDeExpedienteSalvo');
  });
});
