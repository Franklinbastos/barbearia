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

  it('preserva a densidade de balcão', () => {
    expect(css).toMatch(/--tap-min:\s*44px/);
    expect(css).toMatch(/--tap-md:\s*52px/);
  });

  it('preserva a cor de estado, que não gira com a marca', () => {
    for (const tom of ['ok', 'perigo', 'alerta', 'agora']) {
      expect(css).toContain(`--${tom}`);
    }
  });
});
