import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('globals.css — camada base', () => {
  it('declara color-scheme, senão os seletores nativos de data e hora quebram no escuro', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/);
  });

  it('não força mais Arial por cima do token de fonte', () => {
    expect(css).not.toMatch(/font-family:\s*Arial/i);
  });

  it('repõe o cursor e a fonte que o preflight tira dos controles', () => {
    // sem a flag /s de propósito: o tsconfig mira ES2017 e o padrão não usa `.`
    expect(css).toMatch(/button[^{]*\{[^}]*cursor:\s*pointer/);
    expect(css).toMatch(/font:\s*inherit/);
  });

  it('define o alvo de toque mínimo como custom property', () => {
    // `--tap-min` continua em 44px: é piso de acessibilidade da barra fixa do
    // encaixe e dos botões da folha, não densidade — ali o alvo de dedo precisa
    // ser maior que o controle.
    expect(css).toMatch(/--tap-min:\s*44px/);
    // `--tap-md` era 52px, a "altura de balcão" da direção de UI antiga. Por
    // decisão do dono em 13/08/2026 a densidade passou a ser a do shadcn, e o
    // token virou apelido da altura de controle da lib. A asserção fica: ela
    // guarda que a altura é escolhida, não herdada por acidente.
    expect(css).toMatch(/--tap-md:\s*var\(--altura-controle\)/);
    expect(css).toMatch(/--altura-controle:\s*36px/);
  });

  it('define foco visível para navegação por teclado', () => {
    expect(css).toMatch(/:focus-visible/);
  });

  it('define os tons de bloco que os componentes consomem', () => {
    for (const tom of ['perigo', 'ok', 'alerta', 'agora']) {
      expect(css).toContain(`.bloco--${tom}`);
    }
  });
});
