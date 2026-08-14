// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { GraficoDeOcupacao, resumoDaSerie } from './grafico-de-ocupacao';

/**
 * O único gráfico da tela era o único conteúdo sem alternativa em texto: quem
 * usa leitor de tela chegava num desenho mudo. A curva é a informação aqui —
 * "onde afunda é onde promover" —, então a alternativa precisa dizer a forma,
 * não só que existe um gráfico.
 */

const DADOS = [
  { hora: 9, taxa: 0.8 },
  { hora: 10, taxa: 0.75 },
  { hora: 11, taxa: 0.4 },
  { hora: 12, taxa: 0.9 },
];

describe('resumoDaSerie', () => {
  it('diz a série inteira, hora por hora', () => {
    const r = resumoDaSerie(DADOS);
    expect(r).toContain('9h 80%');
    expect(r).toContain('11h 40%');
  });

  it('aponta o buraco e o pico, que é o que a forma da curva responde', () => {
    const r = resumoDaSerie(DADOS);
    expect(r).toContain('Mais vazia às 11h');
    expect(r).toContain('mais cheia às 12h');
  });

  it('com uma hora só não inventa pico nem buraco', () => {
    expect(resumoDaSerie([{ hora: 9, taxa: 0.5 }])).toBe('Ocupação por hora: 9h 50%.');
  });
});

describe('GraficoDeOcupacao', () => {
  it('tem alternativa textual: o leitor de tela ouve a série, não um svg mudo', () => {
    render(<GraficoDeOcupacao dados={DADOS} />);
    const alternativa = screen.getByRole('img');
    expect(alternativa.getAttribute('aria-label')).toBe(resumoDaSerie(DADOS));
  });
});
