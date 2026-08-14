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

describe('acabamento da agenda', () => {
  it('a faixa de navegação tem teto de largura no desktop', () => {
    // sem teto, o `1fr` do meio dá ~1300px ao botão que escreve "sexta, 14 de agosto"
    expect(barra).toMatch(/<Largura/);
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
