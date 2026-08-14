import type { IndicadoresDeCliente } from '@/domain/indicadores/cliente';
import { JANELA_DE_RETORNO } from '@/domain/indicadores/cliente';

/**
 * A linha de apoio do card de Taxa de retorno — e o motivo de ela ter três
 * versões, não duas.
 *
 * O card mostrava `0%` na tela inteira porque a guarda era "ninguém estreou no
 * período", quando o denominador de verdade é **quem já teve 90 dias para
 * voltar**. Em Hoje, Semana e Mês há estreante e não há coorte madura: o card
 * caía no ramo do percentual e estampava zero todo dia.
 *
 * Com o traço no lugar do zero, a linha de apoio passa a ser o que explica qual
 * dos casos o dono está olhando — e os dois vazios dizem coisas diferentes:
 *
 * - **ninguém estreou**: não há sobre quem medir retorno neste período;
 * - **estrearam, mas é cedo**: há gente na fila, o prazo é que não fechou. Aqui
 *   o texto conta quantos são, senão o traço parece defeito da tela;
 * - **coorte madura**: aí sim há percentual, e o apoio diz de quantos ele saiu.
 */
export function apoioDoRetorno(clientes: IndicadoresDeCliente): string {
  if (clientes.coorteDeRetorno > 0) {
    const quem =
      clientes.coorteDeRetorno === 1 ? 'estreante que já teve' : 'estreantes que já tiveram';
    return `de ${clientes.coorteDeRetorno} ${quem} ${JANELA_DE_RETORNO} dias para voltar`;
  }

  if (clientes.novos === 0) return 'ninguém estreou neste período';

  return `${clientes.novos} ${
    clientes.novos === 1 ? 'estreante ainda tem' : 'estreantes ainda têm'
  } ${JANELA_DE_RETORNO} dias para voltar`;
}
