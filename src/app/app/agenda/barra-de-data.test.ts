import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Teste de fonte, no padrão dos outros deste projeto: a barra é `'use client'`
 * com `useRouter`, e montar isso em jsdom custa mais do que mede — o que está em
 * jogo aqui é largura e posição, que é classe, não comportamento.
 */
const ler = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const barra = ler('src/app/app/agenda/barra-de-data.tsx');
const encaixe = ler('src/app/app/agenda/manual-booking-form.tsx');
const pagina = ler('src/app/app/agenda/page.tsx');
const carregando = ler('src/app/app/agenda/loading.tsx');

describe('acabamento da agenda', () => {
  it('a faixa de navegação tem teto de largura no desktop', () => {
    // sem teto, o `1fr` do meio dá ~1300px ao botão que escreve "sexta, 14 de agosto"
    expect(barra).toMatch(/<Largura/);
  });

  it('barra, lista e esqueleto ficam no mesmo degrau das outras telas de lista', () => {
    // `leitura` na agenda e `tabela` nas irmãs é a agenda pulando 240px para
    // fora do alinhamento de quem está ao lado dela na navegação
    for (const fonte of [barra, pagina, carregando]) {
      expect(fonte).toMatch(/tipo="tabela"/);
      expect(fonte).not.toMatch(/tipo="leitura"/);
    }
  });

  it('o botão de data não herda o `1fr` da grade no desktop', () => {
    // 932px de botão para ~150px de texto; no celular o `1fr` continua certo
    expect(barra).toMatch(/grid-cols-\[44px_1fr_44px\].*md:grid-cols-\[44px_\d+px_44px\]/);
  });

  it('a agenda abre com o mesmo cabeçalho das telas irmãs', () => {
    // era a única do painel sem título à vista, e por isso parecia de outro produto
    expect(pagina).toMatch(/<CabecalhoDePagina/);
    expect(pagina).toMatch(/titulo="Agenda"/);
    // escondido no celular é decisão de espaço, e aí é `md:` explícito — nunca
    // `sr-only` sempre, que era o que apagava o título nas duas larguras
    expect(pagina).toMatch(/sr-only md:not-sr-only/);
  });

  it('"Voltar para hoje" não é um botão de 1400px no desktop', () => {
    // `w-full` sem contraparte `md:` é o botão que atravessa a tela inteira
    const linha = barra.split('\n').find((l) => l.includes("'w-full no-underline'"));
    expect(linha).toBeUndefined();
  });

  it('o encaixe do desktop não fica numa linha só dele', () => {
    // `md:justify-end` sozinho num `div` é o botão flutuando no canto
    expect(encaixe).not.toMatch(/mb-3 hidden md:flex md:justify-end/);
  });
});
