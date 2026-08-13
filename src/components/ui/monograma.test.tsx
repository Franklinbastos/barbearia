// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Monograma, iniciaisDe } from './monograma';

/**
 * Em 13/08/2026 o `Monograma` deixou de ser implementação própria e passou a
 * compor o `Avatar`+`AvatarFallback` da lib. O que os casos abaixo guardam é o
 * que a troca **não** podia levar junto: as iniciais certas, o `aria-hidden` (o
 * nome está sempre escrito ao lado) e o fato de o componente continuar
 * renderizável sem `'use client'` no arquivo — quatro chamadores são Server
 * Components.
 */
describe('iniciaisDe', () => {
  it('usa a primeira e a última palavra', () => {
    expect(iniciaisDe('Marcos Aurélio Silva')).toBe('MS');
  });

  it('com um nome só, usa uma letra', () => {
    expect(iniciaisDe('Marcão')).toBe('M');
  });

  it('nome vazio não vira letra nenhuma', () => {
    expect(iniciaisDe('   ')).toBe('');
  });
});

describe('Monograma', () => {
  it('escreve as iniciais dentro do fallback do avatar da lib', () => {
    const { container } = render(<Monograma nome="João Pedro" />);
    const fallback = container.querySelector('[data-slot="avatar-fallback"]');
    expect(fallback?.textContent).toBe('JP');
  });

  it('fica fora do leitor de tela — o nome está escrito ao lado', () => {
    const { container } = render(<Monograma nome="João Pedro" />);
    const raiz = container.querySelector('[data-slot="avatar"]');
    expect(raiz?.getAttribute('aria-hidden')).toBe('true');
  });

  it('o tamanho 40 é o `size="lg"` da lib, sem utilitário por cima', () => {
    const { container } = render(<Monograma nome="João Pedro" />);
    const raiz = container.querySelector('[data-slot="avatar"]');
    expect(raiz?.getAttribute('data-size')).toBe('lg');
    expect(raiz?.className).not.toMatch(/\bsize-14\b/);
  });

  it('o tamanho 56 não existe na lib e entra por utilitário', () => {
    const { container } = render(<Monograma nome="João Pedro" tamanho={56} />);
    expect(container.querySelector('[data-slot="avatar"]')?.className).toMatch(/\bsize-14\b/);
  });
});
