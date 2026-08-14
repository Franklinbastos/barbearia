import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Teste de fonte, como os outros de acabamento deste painel: o que estas duas
 * telas erravam não era comportamento, era largura declarada no arquivo — e
 * jsdom não mede layout, então montar as páginas aqui custaria mais do que mede.
 */
const ler = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('acabamento de serviços e equipe', () => {
  for (const tela of ['servicos', 'equipe'] as const) {
    it(`${tela}: usa a régua em vez de largura própria`, () => {
      const pagina = ler(`src/app/app/${tela}/page.tsx`);
      expect(pagina).not.toMatch(/max-w-\[\d+px\]/);
      expect(pagina).toMatch(/<Largura/);
    });

    it(`${tela}: o formulário e a lista têm a mesma largura`, () => {
      // 520 do formulário sobre 720 da lista é o degrau que aparece na captura
      const form = ler(`src/app/app/${tela}/${tela === 'servicos' ? 'servico' : 'staff'}-form.tsx`);
      expect(form).not.toMatch(/max-w-\[\d+px\]/);
    });

    it(`${tela}: o esqueleto tem a largura da tela que ele antecede`, () => {
      expect(ler(`src/app/app/${tela}/loading.tsx`)).not.toMatch(/max-w-\[\d+px\]/);
    });
  }

  it('serviços: cabeçalho e linhas usam a mesma grade', () => {
    // cabeçalho e corpo com definições diferentes desalinham as colunas
    const pagina = ler('src/app/app/servicos/page.tsx');
    const grades = [...pagina.matchAll(/md:grid-cols-\[([^\]]+)\]|grid-cols-\[([^\]]+)\]/g)]
      .map((m) => m[1] ?? m[2])
      .filter((g) => g.includes('fr'));
    expect(new Set(grades).size).toBeLessThanOrEqual(2); // uma de celular, uma de desktop
  });
});
