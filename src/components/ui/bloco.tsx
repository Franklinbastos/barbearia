import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Alert } from './alert';

/**
 * Toda caixa de mensagem do produto: informação, confirmação, erro, alerta e
 * "acontecendo agora".
 *
 * Substitui os três tons de alerta inline que estavam espalhados por 11
 * arquivos, nenhum deles legível no tema escuro.
 *
 * `papel` vira `role`: `'alert'` para o erro que o usuário precisa ouvir agora,
 * `'status'` para a confirmação que pode esperar a pausa do leitor de tela.
 *
 * Por dentro compõe o `Alert` do shadcn (estilo `base-nova`), que traz o
 * `data-slot="alert"` e o `cva`. A **aparência continua nossa**: vem das classes
 * `.bloco`/`.bloco--*` da §3.1. O que o `cva` daqui acrescenta é o desfazimento
 * das decisões de aparência que o base-nova embute — ver `DESFAZ_O_BASE_NOVA`.
 *
 * **Sem `'use client'`, de propósito.** Onze dos treze usos estão em Server
 * Components, e o `Bloco` não tem estado nenhum.
 */
export type BlocoProps = {
  tom?: 'info' | 'ok' | 'perigo' | 'alerta' | 'agora';
  papel?: 'alert' | 'status';
  compacto?: boolean;
  /** Botão abaixo do texto. */
  acao?: ReactNode;
  children: ReactNode;
};

/**
 * O texto-base do `alert` do base-nova não é neutro: ele decide aparência.
 * Cada linha aqui desfaz exatamente uma dessas decisões, e todas caem por
 * conflito de grupo no `tailwind-merge` ou por propriedade que não compete —
 * nada some por ordem de declaração.
 *
 * Sem isto a tela muda em três pontos que nenhum teste de componente vê: os dois
 * parágrafos do `/error` se afastariam 2px (o `grid` acrescenta `gap` onde hoje
 * há fluxo de bloco), o vazio da agenda pararia de centralizar (`text-left`), e
 * a barra de 4px da esquerda — a marca visual do bloco — encolheria para 1px,
 * porque o `border` do base-nova é utilitário e utilitário vence a camada de
 * componente inteira. Os três foram medidos com `getComputedStyle` numa página
 * de comparação lado a lado, antes e depois.
 */
const DESFAZ_O_BASE_NOVA = [
  'block', //   desfaz `grid`: o filho volta ao fluxo de bloco, sem gap entre parágrafos
  'w-auto', //  desfaz `w-full`: o bloco volta a ter a largura que o pai dá
  'static', //  desfaz `relative`, que só existe lá para o `alert-action` que não usamos
  'border-l-4', // repõe a barra de 4px que o `border` do base-nova apagou
  // O `!` aqui não é preguiça: `text-align` é a única das cinco em que o
  // `tailwind-merge` não tem como ajudar. Ele resolve por grupo de classe, e
  // uma propriedade arbitrária não entra no grupo `text-align` — as duas
  // sobrevivem ao `cn()` e a briga vai para a ordem do arquivo, onde o Tailwind
  // emite as arbitrárias ANTES das nomeadas (byte 7 985 contra 12 000 no CSS
  // compilado). Sem o `!`, o `text-left` do base-nova vence e o vazio da agenda,
  // que é centralizado pelo pai, encosta à esquerda.
  '[text-align:inherit]!',
  // `rounded-lg` fica: `--radius-lg` é `var(--radius)`, que é `var(--r)`, que é
  // exatamente o raio que `.bloco` já pedia. Trocar não mudaria um pixel.
].join(' ');

export const blocoVariants = cva(['bloco', DESFAZ_O_BASE_NOVA], {
  variants: {
    tom: {
      info: '',
      ok: 'bloco--ok',
      perigo: 'bloco--perigo',
      alerta: 'bloco--alerta',
      agora: 'bloco--agora',
    },
    // Recheio e tipografia repetidos como utilitário porque o base-nova os
    // escreve como utilitário (`px-2.5 py-2 text-sm`) e `.bloco` não alcança
    // mais. Os valores são os mesmos da §3.1: 16px de recheio e 16/24 no
    // normal, 8×10 e 14/20 no compacto.
    compacto: {
      true: 'bloco--compacto px-2.5 py-2 text-sm',
      false: 'p-4 text-base',
    },
  },
  defaultVariants: { tom: 'info', compacto: false },
});

export function Bloco({ tom = 'info', papel, compacto = false, acao, children }: BlocoProps) {
  return (
    <Alert
      // O `Alert` embute `role="alert"` no elemento. Onze dos treze usos são
      // texto informativo parado na tela, e anunciar todos na hora é ruído no
      // leitor de tela — `role={undefined}` apaga o atributo pelo espalhamento.
      role={papel}
      // `variant` em `null` desliga a paleta do base-nova de propósito: o
      // `default` de lá pinta `bg-card` por utilitário, que venceria os cinco
      // fundos de `.bloco--*` e deixaria erro, alerta e "agora" todos cinza.
      variant={null}
      className={cn(blocoVariants({ tom, compacto }))}
    >
      {children}
      {acao ? <div className="mt-3">{acao}</div> : null}
    </Alert>
  );
}
