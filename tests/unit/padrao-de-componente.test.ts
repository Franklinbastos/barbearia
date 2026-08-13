import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Os quatro componentes sem equivalente no shadcn.
 *
 * Eles continuam nossos — o registry não tem nada que resolva tira de dias,
 * grade de horários, confirmação em dois tempos nem cabeçalho de tela. O que
 * este teste guarda é a **forma**: por dentro eles têm que se parecer com os
 * que vieram do CLI, para que a próxima pessoa que abrir um arquivo de
 * `src/components/ui` encontre sempre a mesma anatomia.
 */
const NOSSOS = ['tira-de-dias', 'grade-de-horarios', 'botao-de-confirmacao', 'cabecalho-de-pagina'];

describe.each(NOSSOS)('src/components/ui/%s.tsx', (nome) => {
  const fonte = readFileSync(resolve(process.cwd(), `src/components/ui/${nome}.tsx`), 'utf8');

  it('usa cn() para aceitar className de fora', () => {
    expect(fonte).toContain("from '@/lib/utils'");
    expect(fonte).toMatch(/\bcn\(/);
  });

  it('marca as partes com data-slot', () => {
    expect(fonte).toMatch(/data-slot="/);
  });

  it('não usa forwardRef — no React 19 ref é prop comum', () => {
    expect(fonte).not.toMatch(/forwardRef/);
  });

  it('exporta o cva das variantes, para quem quiser compor de fora', () => {
    expect(fonte).toMatch(/export const \w+Variants = cva\(/);
  });

  it('parte de ComponentProps, e não de um tipo fechado', () => {
    expect(fonte).toMatch(/ComponentProps</);
  });
});
