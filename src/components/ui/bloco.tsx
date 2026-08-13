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
 * Por dentro compõe o `Alert` do shadcn (estilo `base-nova`), e **desde
 * 13/08/2026 a aparência é a de lá**: `grid`, largura total, texto à esquerda,
 * 14px, recheio de 8×10 e borda igual nos quatro lados. Antes havia um bloco
 * `DESFAZ_O_BASE_NOVA` anulando cada uma dessas decisões — inclusive a barra de
 * 4px na esquerda, que era a marca visual do bloco na direção antiga. Saiu com o
 * resto.
 *
 * O que continua nosso é **cor**: a lib só tem `default` e `destructive`, e
 * nenhum dos dois pinta fundo de estado. Os cinco tons vêm por utilitário,
 * porque o `bg-card` do `default` também é utilitário e venceria a classe
 * `.bloco--*` do `globals.css` — que segue existindo para os dois usos crus da
 * página pública.
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
 * `perigo` é o único que tem semântica na lib. Os outros três tons de estado
 * caem em `default` e recebem a cor por cima.
 */
const VARIANTE_DA_LIB = {
  info: 'default',
  ok: 'default',
  perigo: 'destructive',
  alerta: 'default',
  agora: 'default',
} as const;

export const blocoVariants = cva('', {
  variants: {
    tom: {
      info: '',
      ok: 'bg-ok-bg border-ok',
      // o `destructive` da lib já pinta o texto; o fundo e a borda são nossos
      perigo: 'bg-perigo-bg border-perigo',
      alerta: 'bg-alerta-bg border-alerta',
      agora: 'bg-agora-bg border-agora',
    },
    // O normal é o do `alert` da lib (px-2.5 py-2, text-sm) e não precisa de
    // classe nenhuma. O compacto desce um degrau na mesma escala.
    compacto: {
      true: 'px-2 py-1.5 text-xs',
      false: '',
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
      variant={VARIANTE_DA_LIB[tom]}
      className={cn(blocoVariants({ tom, compacto }))}
    >
      {children}
      {acao ? <div className="mt-3">{acao}</div> : null}
    </Alert>
  );
}
