import { janelaEmCurso, type Janela } from '@/domain/indicadores/periodo';
import type { ComparacaoDoIndicador } from './cartao-indicador';

/**
 * O selo de comparação com o período anterior — o texto e o sentido.
 *
 * **A comparação de janela em curso comparava coisas diferentes.** Numa segunda
 * às 10h, o card de Faturamento punha meia manhã contra sete dias inteiros da
 * semana passada e estampava uma queda de 95% numa loja que não tinha perdido
 * um cliente. Os dois números estavam certos; a comparação é que não existia.
 *
 * A saída foi comparar **percurso com percurso**: quem chama lê o período
 * anterior só até o mesmo ponto de avanço (`recorteEquivalente`, em
 * `periodo.ts`), e este módulo põe a ressalva no texto — "até aqui". Sem a
 * ressalva o dono leria "+20% que a semana passada" numa segunda de manhã e
 * entenderia que a semana inteira já superou a anterior.
 *
 * A alternativa era esconder o selo em janela em curso. Foi descartada: é
 * justamente na semana corrente que o dono olha a tela, e um selo que só
 * aparece depois de a semana acabar não serve para decidir nada — o valor da
 * comparação está em saber, na quarta, se a semana está melhor que a passada.
 */
function rotuloDoAnterior(janela: Janela, emCurso: boolean): string {
  const nome =
    janela.periodo === 'hoje'
      ? 'que ontem'
      : janela.periodo === 'semana'
        ? 'que a semana passada'
        : janela.periodo === 'mes'
          ? 'que o mês passado'
          : 'que o período anterior';

  if (!emCurso) return nome;
  // "até esta hora" no dia e "até aqui" no resto: comparar um dia pela metade
  // com o dia inteiro de ontem é uma ressalva de relógio, não de calendário.
  return janela.periodo === 'hoje' ? `${nome} até esta hora` : `${nome} até aqui`;
}

export type CompararComAnteriorArgs = {
  atualCents: number;
  /**
   * O mesmo indicador no período anterior, **já recortado no ponto
   * equivalente** quando a janela está em curso.
   */
  anteriorCents: number;
  janela: Janela;
  agora: Date;
};

/**
 * A comparação com o período anterior, ou nada.
 *
 * **Sem base não há comparação.** Dividir por um período anterior zerado daria
 * "+∞%" ou um "+100%" inventado — a primeira semana de uma barbearia nova
 * apareceria como crescimento espetacular. Nesses casos o card simplesmente
 * não mostra o selo.
 */
export function compararComAnterior(
  args: CompararComAnteriorArgs,
): ComparacaoDoIndicador | undefined {
  const { atualCents, anteriorCents, janela, agora } = args;
  if (anteriorCents <= 0) return undefined;

  const variacao = Math.round(((atualCents - anteriorCents) / anteriorCents) * 100);
  const sinal = variacao > 0 ? '+' : '';

  return {
    valor: `${sinal}${variacao}% ${rotuloDoAnterior(janela, janelaEmCurso(janela, agora))}`,
    melhorou: atualCents >= anteriorCents,
  };
}
