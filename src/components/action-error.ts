'use client';

import { unstable_rethrow } from 'next/navigation';

/**
 * Mensagem única de falha de server action disparada por botão.
 *
 * Em produção o Next apaga a mensagem original do erro antes de mandar para o
 * navegador (sobra só o `digest`), então não há detalhe útil para exibir — e
 * mostrar o texto cru vazaria interno em desenvolvimento. O que o usuário
 * precisa saber é que nada aconteceu e que a tela pode estar desatualizada.
 */
export const MENSAGEM_PADRAO_DE_ACAO =
  'Não foi possível concluir. Atualize a página e tente de novo.';

/**
 * Lê a falha de um retorno de server action.
 *
 * As actions do painel estão em evolução: hoje algumas lançam, outras devolvem
 * `{ erro }`. Aqui a leitura é defensiva de propósito — se a action passar a
 * devolver o erro em vez de lançar, o botão continua avisando.
 */
export function erroDoRetorno(retorno: unknown): string | null {
  if (!retorno || typeof retorno !== 'object') return null;
  const objeto = retorno as { erro?: unknown; error?: unknown; ok?: unknown };

  for (const valor of [objeto.erro, objeto.error]) {
    if (typeof valor === 'string' && valor.trim() !== '') return valor;
  }
  if (objeto.ok === false) return MENSAGEM_PADRAO_DE_ACAO;
  return null;
}

/**
 * Executa a server action e entrega a falha por `aoFalhar`, sem nunca deixar a
 * exceção subir sem boundary — que é o que hoje derruba a tela inteira quando o
 * agendamento já foi cancelado em outra aba.
 *
 * Erros de controle de fluxo do Next (`redirect`, `notFound`) continuam subindo.
 */
export async function executarAcao(
  acao: () => unknown | Promise<unknown>,
  aoFalhar: (mensagem: string) => void,
): Promise<void> {
  try {
    const retorno = await acao();
    const mensagem = erroDoRetorno(retorno);
    if (mensagem) aoFalhar(mensagem);
  } catch (erro) {
    unstable_rethrow(erro);
    aoFalhar(MENSAGEM_PADRAO_DE_ACAO);
  }
}
