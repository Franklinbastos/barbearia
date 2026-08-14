// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Largura, larguraVariants } from './largura';

const px = (tipo: 'formulario' | 'tabela' | 'leitura') =>
  Number(larguraVariants({ tipo }).match(/max-w-\[(\d+)px\]/)?.[1] ?? 0);

describe('Largura', () => {
  it('os degraus são ordenados: formulário < tabela < leitura', () => {
    // uma régua com dois degraus iguais não é régua: quem escrever a próxima
    // tela vai escolher no olho de novo
    expect(px('formulario')).toBeLessThan(px('tabela'));
    expect(px('tabela')).toBeLessThan(px('leitura'));
  });

  it('cheia não limita nada', () => {
    expect(larguraVariants({ tipo: 'cheia' })).not.toMatch(/max-w-\[/);
  });

  it('repassa className de fora sem perder a largura', () => {
    render(
      <Largura tipo="tabela" className="mt-4" data-testid="x">
        oi
      </Largura>,
    );
    const el = screen.getByTestId('x');
    expect(el.className).toMatch(/mt-4/);
    expect(el.className).toMatch(/max-w-\[/);
  });

  it('marca a parte com data-slot', () => {
    render(
      <Largura tipo="leitura" data-testid="x">
        oi
      </Largura>,
    );
    expect(screen.getByTestId('x').getAttribute('data-slot')).toBe('largura');
  });

  it('o padrão é leitura', () => {
    render(<Largura data-testid="x">oi</Largura>);
    expect(screen.getByTestId('x').className).toContain(larguraVariants({ tipo: 'leitura' }));
  });
});
