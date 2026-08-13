import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cn } from '@/lib/utils';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
const componentsJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'components.json'), 'utf8'),
);

describe('cn', () => {
  it('junta classes', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('a última classe conflitante vence — é para isso que serve o tailwind-merge', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('ignora falsy', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});

describe('components.json', () => {
  it('usa o mesmo estilo do bdsolutions', () => {
    expect(componentsJson.style).toBe('base-nova');
    expect(componentsJson.tailwind.baseColor).toBe('neutral');
    expect(componentsJson.tailwind.cssVariables).toBe(true);
    expect(componentsJson.iconLibrary).toBe('lucide');
    expect(componentsJson.rsc).toBe(true);
  });

  it('instala em src/components/ui', () => {
    expect(componentsJson.aliases.ui).toBe('@/components/ui');
    expect(componentsJson.aliases.utils).toBe('@/lib/utils');
  });
});

describe('tokens canônicos', () => {
  // O shadcn gera classes como bg-background e text-destructive. Sem estes
  // nomes, todo componente que vier do CLI sai sem cor.
  const CANONICOS = [
    'background', 'foreground', 'primary', 'primary-foreground',
    'secondary', 'muted', 'muted-foreground', 'accent',
    'destructive', 'border', 'input', 'ring', 'card', 'popover', 'radius',
  ];

  it.each(CANONICOS)('declara --%s', (nome) => {
    expect(css).toMatch(new RegExp(`--${nome}\\s*:`));
  });

  /**
   * Este caso guardava a densidade de balcão: `--tap-md` em 52px, a altura que a
   * direção de UI antiga defendia para quem toca o botão em pé, com o dedo com
   * talco. Em 13/08/2026 o dono trocou essa densidade por fidelidade ao shadcn,
   * e a altura de controle passou a ser a da lib (`h-9`, 36px). O caso fica, com
   * o valor novo: ele guarda que a altura é escolhida aqui, e não herdada por
   * acidente de quem esquecer o token.
   *
   * `--tap-min` não muda porque não é densidade: é o piso de acessibilidade da
   * barra fixa do encaixe e da folha inferior, onde o alvo de dedo precisa ser
   * maior que o controle.
   */
  it('a altura de controle é a da lib, e o alvo de acessibilidade continua acima dela', () => {
    expect(css).toMatch(/--altura-controle:\s*36px/);
    expect(css).toMatch(/--tap-min:\s*44px/);
    expect(css).toMatch(/--tap-md:\s*var\(--altura-controle\)/);
    expect(css).not.toMatch(/--tap-md:\s*52px/);
  });

  it('preserva a cor de estado, que não gira com a marca', () => {
    for (const tom of ['ok', 'perigo', 'alerta', 'agora']) {
      expect(css).toContain(`--${tom}`);
    }
  });
});
