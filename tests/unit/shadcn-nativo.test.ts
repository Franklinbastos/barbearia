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
});
