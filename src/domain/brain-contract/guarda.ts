import { timingSafeEqual } from 'node:crypto';

/**
 * Guarda de servidor-para-servidor dos endpoints do brain.
 *
 * Só o brain chama esses endpoints, com a chave `BRAIN_API_KEY` no header. A
 * comparação é em tempo constante, como em `lib/tokens.ts` e no cron: comparar
 * string com `===` vaza o tamanho do prefixo certo pelo tempo de resposta.
 *
 * Falha fechada de propósito: sem `BRAIN_API_KEY` configurada, a chave esperada
 * é `undefined` e nenhuma requisição passa. O plug fica desligado até o dono
 * gerar o segredo — endpoint aberto por engano seria pior que endpoint fechado.
 */
export function conferirChaveDoBrain(
  recebida: string | null | undefined,
  esperada: string | undefined,
): boolean {
  if (!esperada) return false;

  const a = Buffer.from(recebida ?? '');
  const b = Buffer.from(esperada);
  // `timingSafeEqual` exige buffers do mesmo tamanho; tamanho diferente já é
  // chave errada, e comparar o comprimento antes não vaza nada útil.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
