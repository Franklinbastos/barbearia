import { describe, it, expect, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import ErroGlobal from './error';
import ErroDoPainel from './app/error';

/** Concatena o texto de uma árvore de elementos React, sem precisar de DOM. */
function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === 'boolean') return '';
  if (typeof no === 'string' || typeof no === 'number') return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join('');
  if (isValidElement(no)) {
    const props = no.props as { children?: ReactNode };
    return textoDe(props.children);
  }
  return '';
}

/** Primeiro elemento da árvore cujo texto casa com `rotulo`. */
function acharPorTexto(no: ReactNode, rotulo: RegExp): ReactElement | null {
  if (Array.isArray(no)) {
    for (const filho of no) {
      const achado = acharPorTexto(filho, rotulo);
      if (achado) return achado;
    }
    return null;
  }
  if (!isValidElement(no)) return null;
  const props = no.props as { children?: ReactNode };
  const dentro = acharPorTexto(props.children, rotulo);
  if (dentro) return dentro;
  return rotulo.test(textoDe(no)) ? no : null;
}

const ERRO = Object.assign(new Error('Failed query: update "appointment"'), { digest: 'abc123' });

describe.each([
  ['boundary da raiz', ErroGlobal],
  ['boundary do painel', ErroDoPainel],
])('%s', (_nome, Boundary) => {
  it('avisa em pt-BR, sem vazar o erro interno', () => {
    const texto = textoDe(Boundary({ error: ERRO, retry: vi.fn() }));

    expect(texto).toMatch(/[áâãéêíóôõúç]/i);
    expect(texto).not.toContain('Failed query');
    expect(texto).not.toMatch(/appointment|update/i);
  });

  it('oferece um botão de tentar de novo que chama retry', () => {
    const retry = vi.fn();
    const botao = acharPorTexto(Boundary({ error: ERRO, retry }), /tentar de novo/i);

    expect(botao).not.toBeNull();
    const props = botao!.props as { onClick?: () => void };
    expect(typeof props.onClick).toBe('function');
    props.onClick!();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('mostra o código do erro para o usuário conseguir relatar', () => {
    expect(textoDe(Boundary({ error: ERRO, retry: vi.fn() }))).toContain('abc123');
  });

  it('não quebra quando o erro não tem digest', () => {
    const texto = textoDe(Boundary({ error: new Error('x'), retry: vi.fn() }));
    expect(texto.length).toBeGreaterThan(0);
  });
});
