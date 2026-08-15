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

  it('o botão de data não estica no desktop', () => {
    // 932px de botão para ~150px de texto; no celular ele continua esticando
    // entre as duas setas, que lá é o certo. Era `grid-cols-[44px_1fr_44px]`
    // até a barra virar uma linha só — a medida é a mesma, o dono dela é que
    // passou a ser o próprio botão.
    const gatilho = barra.split('\n').find((l) => l.includes('md:flex-none'));
    expect(gatilho).toMatch(/flex-1/);
    expect(gatilho).toMatch(/md:w-60/);
  });

  it('o esqueleto da barra deixa o mesmo respiro que a barra que chega', () => {
    // 4px de diferença entre o `loading.tsx` e a barra de verdade é a lista
    // saltando quando os dados chegam — o pulo que o `loading.tsx` existe para
    // não ter.
    const respiro = (fonte: string) => /className="-mx-3 mb-(\d+) md:-mx-5"/.exec(fonte)?.[1];
    expect(respiro(carregando)).toBe(respiro(barra));
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

describe('a barra de uma linha só', () => {
  it('o "Hoje" é botão da barra, não faixa embaixo', () => {
    // era um <Link w-full> numa faixa própria, que aparecia e sumia mudando a
    // altura da barra e ficava alinhado com nada
    expect(barra).not.toMatch(/Voltar para hoje/);
    // `\s*` de propósito: o rótulo é o que importa, e um `>Hoje<` colado
    // amarraria o caso à quebra de linha do JSX, que não é regra de nada.
    expect(barra).toMatch(/>\s*Hoje\s*</);
  });

  it('as duas setas ficam juntas, do mesmo lado', () => {
    // nenhuma fonte da pesquisa cerca o rótulo com uma seta de cada lado;
    // Google, FullCalendar, react-big-calendar e o ReUI agrupam
    const grade = barra.match(/grid-cols-\[[^\]]+\]/g) ?? [];
    expect(grade.join(' ')).not.toMatch(/44px_1fr_44px/);
  });

  it('o "Hoje" desabilita em vez de sumir quando já é hoje', () => {
    // é o que o FullCalendar faz; sumir muda a largura dos vizinhos a cada dia
    expect(barra).toMatch(/disabled=\{eHoje\}|disabled=\{.*hoje/i);
  });

  it('a contagem é inline, não uma faixa de 20px', () => {
    expect(barra).not.toMatch(/<p[^>]*h-5[^>]*>\s*\{contagens/);
  });

  it('no celular a ordem continua [‹] [data] [›], e o "Hoje" não entra na linha', () => {
    // três botões antes do rótulo truncariam "sexta, 15 de agosto", e o
    // Material 3 proíbe em letra ("Don't truncate the headline text"). Lá o "ir
    // para hoje" mora dentro do popover do calendário, e a linha de baixo é a
    // mesma de sempre — abaixo de 768px esta rodada não mexe em nada.
    expect(barra).toMatch(/aria-label="Ontem"[\s\S]{0,200}-order-3 md:order-none/);
    expect(barra).toMatch(/aria-label=\{rotuloDaData\}[\s\S]{0,200}-order-2/);
    expect(barra).toMatch(/aria-label="Amanhã"[\s\S]{0,200}-order-1 md:order-none/);
    expect(barra).toMatch(/hidden h-11 px-4 md:inline-flex/);
  });

  it('a barra monta um calendário só, e não um por largura', () => {
    // Duas ordens (`Hoje ‹ › data` no desktop, `‹ data ›` no celular) tentam
    // virar dois blocos irmãos com `md:hidden` — e não podem: o
    // `PopoverContent` sai por `Portal`, o `hidden` do pai não o alcança, e os
    // dois calendários abrem juntos porque dividem o mesmo `aberto`. A troca é
    // de `order`.
    expect(barra.match(/<PopoverContent/g)?.length).toBe(1);
    expect(barra.match(/aria-label=\{rotuloDaData\}/g)?.length).toBe(1);
  });

  it('o gatilho de data não esconde o dia atrás de um rótulo de uma palavra', () => {
    // WCAG 2.5.3 (Label in Name): o `aria-label="Data"` **cobria** o texto
    // visível, e aí quem comanda por voz fala "sexta, 15 de agosto" e não casa
    // com nada. O nome acessível passa a começar pelo próprio rótulo do dia.
    expect(barra).toMatch(/const rotuloDaData = `\$\{rotuloDoDia\(diaSelecionado\)\}/);
    expect(barra).not.toMatch(/aria-label="Data"/);
  });
});
