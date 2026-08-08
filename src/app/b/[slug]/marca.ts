import type { CSSProperties } from 'react';

/**
 * Cor da loja na superfície pública (§3.4).
 *
 * O dono controla **um número**: o matiz. L e croma são nossos e travados, então
 * nenhuma escolha dele produz botão ilegível — claro fica em ~5,1:1 sob texto
 * branco, escuro em ~12:1 sobre o fundo. Croma 0.09 porque cabe no sRGB em todo
 * o círculo; 0.115 estoura em 21 dos 36 matizes.
 *
 * O objeto vai inline no `<div>` raiz do assistente, **nunca no `<html>`**: o
 * documento não pode virar dinâmico por loja, senão a página pública perde o
 * cache de borda.
 *
 * Onde `--marca` pode aparecer é lista fechada (§3.4): trilho de progresso,
 * traço sob o título da etapa, ficha de dia selecionada, bloco "Qualquer
 * barbeiro" e aresta do bloco de compromisso. Botão primário, anel de foco e
 * cor de estado ficam de fora — barbearia de matiz vermelho não pode perder o
 * vermelho de erro.
 */
export function estiloDaMarca(accentHue: number | null): CSSProperties | undefined {
  if (accentHue === null || !Number.isFinite(accentHue)) return undefined;
  if (accentHue < 0 || accentHue > 360) return undefined;

  return {
    '--marca': `oklch(0.45 0.09 ${accentHue})`,
    '--marca-suave': `oklch(0.955 0.025 ${accentHue})`,
    '--sobre-marca': '#FFFFFF',
  } as CSSProperties;
}
