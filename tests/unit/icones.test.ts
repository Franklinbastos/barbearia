import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Cada SVG escrito à mão é um ícone que ninguém mais vai manter, com tamanho e
 * traço diferentes dos outros. O design doc pedia SVG embutido porque não havia
 * biblioteca de ícone no projeto; com o `lucide-react` da Task 1 instalado, o
 * motivo caiu.
 */
// `readdirSync` recursivo, e não o `globSync` que o plano sugeria: o
// `globSync` só existe no Node 22 e o `@types/node` deste repo é o 20, então
// ele roda mas não compila (`TS2305`).
const arquivos = readdirSync(resolve(process.cwd(), 'src'), {
  recursive: true,
  encoding: 'utf8',
})
  .filter((caminho) => caminho.endsWith('.tsx'))
  .map((caminho) => join('src', caminho));

describe('ícones', () => {
  it('nenhum SVG desenhado à mão sobrou', () => {
    const comSvg = arquivos.filter((f) =>
      readFileSync(resolve(process.cwd(), f), 'utf8').includes('<svg'),
    );
    expect(comSvg).toEqual([]);
  });

  it('todo ícone do lucide é decorativo — o nome está no botão, não no desenho', () => {
    const semAriaHidden: string[] = [];

    for (const arquivo of arquivos) {
      const fonte = readFileSync(resolve(process.cwd(), arquivo), 'utf8');
      if (!fonte.includes("from 'lucide-react'")) continue;

      // Cada uso do ícone é `<Nome ... />`; o `aria-hidden` tem que estar em
      // todos, senão o leitor de tela lê "imagem" no meio do rótulo do botão.
      for (const nome of [...fonte.matchAll(/import \{ ([\w, ]+) \} from 'lucide-react'/g)]
        .flatMap((m) => m[1].split(',').map((n) => n.trim()))
        .filter(Boolean)) {
        for (const uso of fonte.matchAll(new RegExp(`<${nome}\\b[^>]*/>`, 'g'))) {
          if (!uso[0].includes('aria-hidden')) semAriaHidden.push(`${arquivo}: ${uso[0]}`);
        }
      }
    }

    expect(semAriaHidden).toEqual([]);
  });
});
