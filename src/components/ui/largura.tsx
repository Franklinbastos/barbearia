import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * A régua de largura do painel: quatro degraus com nome, no lugar do número
 * escolhido no olho.
 *
 * Antes disto havia quatro larguras mágicas espalhadas por vinte arquivos —
 * `1400`, `720`, `520`, `420` — e nenhuma regra dizendo qual usar quando. O
 * resultado aparecia na primeira dobra: um formulário de 520px empilhado sobre
 * uma lista de 720px, com o degrau visível entre as duas caixas, e o bloco de
 * comissão do barbeiro em 420px ao lado de três irmãos de 720px. **Largura em px
 * solta numa tela é defeito, não escolha** — e `tests/unit/regua-de-largura.test.ts`
 * é a trava que impede a reincidência.
 *
 * Os degraus, e por que são estes:
 *
 * - **`formulario` — 520px.** Campo de formulário não passa disso: linha de
 *   input muito larga faz o olho perder o começo ao voltar, e alvo de clique não
 *   melhora depois de certa largura. É o número que os formulários já usavam;
 *   aqui ele ganha nome em vez de ser recopiado.
 * - **`tabela` — 880px.** Lista com coluna de ação. Os 720px de antes deixavam a
 *   ação apertada e, pior que isso, criavam o degrau contra o formulário de 520
 *   logo acima — que agora divide este mesmo teto com a lista.
 * - **`leitura` — 1120px.** Conteúdo corrido e grade de cards. Fica abaixo dos
 *   1400px do container do painel de propósito: texto que atravessa a tela
 *   inteira cansa.
 * - **`cheia`** — sem teto, para grade que se vira sozinha. É o que o resumo faz
 *   hoje sem precisar declarar, e é a forma certa: `grid-cols-1 sm:grid-cols-2
 *   xl:grid-cols-4` ocupando o container, zero `max-w`.
 *
 * **Centralizado (`mx-auto`).** Foi decisão do dono, depois de ver a primeira
 * versão: alinhado à esquerda, uma lista de 880px numa área útil de 1184px
 * deixava 300px de vazio só do lado direito, e a tela parecia encostada num
 * canto em vez de composta. Centralizar reparte a folga nos dois lados. Vale
 * para o bloco; o texto dentro dele continua alinhado à esquerda.
 *
 * **Sem `'use client'`, de propósito.** É um `<div>` com uma classe, e quem o usa
 * é quase todo Server Component.
 */
export type TipoDeLargura = 'leitura' | 'formulario' | 'tabela' | 'cheia';

export type LarguraProps = ComponentProps<'div'> & {
  tipo?: TipoDeLargura;
};

export const larguraVariants = cva('mx-auto w-full', {
  variants: {
    tipo: {
      leitura: 'max-w-[1120px]',
      formulario: 'max-w-[520px]',
      tabela: 'max-w-[880px]',
      cheia: '',
    },
  },
  defaultVariants: { tipo: 'leitura' },
});

export function Largura({ tipo = 'leitura', className, ...resto }: LarguraProps) {
  return <div data-slot="largura" className={cn(larguraVariants({ tipo }), className)} {...resto} />;
}
