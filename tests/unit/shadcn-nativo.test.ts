import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('forma nativa do shadcn', () => {
  it('o raio é o do shadcn, não os 4px de instrumento', () => {
    expect(css).toMatch(/--radius:\s*0\.625rem/);
  });

  it('a altura de controle é a da lib', () => {
    expect(css).toMatch(/--altura-controle:\s*36px/);
  });

  it('a paleta continua sendo a nossa', () => {
    for (const token of ['--ok', '--perigo', '--alerta', '--agora', '--marca']) {
      expect(css).toContain(`${token}:`);
    }
  });

  it('o botão primário continua fora da cor da loja', () => {
    expect(css).toMatch(/--primary:\s*var\(--tinta\)/);
  });

  /**
   * A Task 2 mapeou a variante `perigo` do `<Botao>` na `destructive` da lib, o
   * que trocou o preenchimento sólido pelo vazado de lá. Isso só é aceitável
   * porque o **matiz** continua sendo o nosso: `text-destructive` e
   * `bg-destructive/10` resolvem em `--perigo`. Se alguém desamarrar esta ponte,
   * a reforma deixa de ser de forma e vira de cor.
   */
  it('o vermelho da lib continua sendo o nosso vermelho', () => {
    expect(css).toMatch(/--destructive:\s*var\(--perigo\)/);
  });
});
