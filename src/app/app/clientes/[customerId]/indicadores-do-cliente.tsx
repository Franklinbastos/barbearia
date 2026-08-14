import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';

import { CartaoIndicador } from '@/app/app/resumo/cartao-indicador';
import type { PerfilDoCliente } from '@/domain/indicadores/perfil-do-cliente';
import { formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Os quatro números da ficha, na mesma grade e no mesmo tijolo do resumo do
 * dono (§5.12 da direção de UI).
 *
 * O cálculo já existia inteiro em `src/domain/indicadores/` e nada chegava
 * aqui: a ficha mostrava nome, telefone, histórico e notas. Estes quatro são os
 * que o mercado mostra — total gasto (todo mundo), taxa de falta (a Booksy), o
 * ritmo por mediana (a Phorest, e nenhum concorrente brasileiro) e os
 * preferidos, que o dono sabe de cor de quem atende há anos e não sabe de quem
 * chegou este mês.
 *
 * **Traço, nunca zero.** "0% de falta" e "nunca teve chance de faltar" são
 * coisas diferentes, e "corta a cada 0 dias" não é frase. Onde o perfil devolve
 * `null` o cartão mostra `—`; onde devolve zero com base de verdade, o zero
 * aparece, porque aí ele é informação (marcou seis, veio nos seis).
 *
 * **A explicação do `Popover` é obrigatória, e aqui mais que no resumo**: "corta
 * a cada 15 dias" sem dizer que é a mediana dos intervalos dele não é número em
 * que o dono confia — e é justamente o número que ele vai usar para mandar
 * mensagem para quem sumiu.
 */
export type IndicadoresDoClienteProps = Omit<ComponentProps<'div'>, 'children'> & {
  perfil: PerfilDoCliente;
  /** Fuso da barbearia — a data da última visita nunca sai no fuso do servidor. */
  timeZone: string;
};

/**
 * A mesma grade da primeira dobra do resumo (`resumo/page.tsx`): uma coluna no
 * celular, duas no tablet, quatro no desktop. Copiada de propósito em vez de
 * "parecida" — duas grades que quase batem é como o produto ganhou quatro
 * larguras mágicas antes da régua.
 */
export const indicadoresDoClienteVariants = cva(
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
);

/** O que a tela mostra quando não há base para o número. */
const TRACO = '—';

function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/**
 * "12 de julho" — dia e mês por extenso, no fuso da loja.
 *
 * Não usa `formatDayLabelLong` porque aquele traz o dia da semana ("domingo, 12
 * de julho"), que numa linha de apoio de 14px é ruído: o que o dono lê ali é
 * quando foi a última vez, não em que dia da semana.
 */
function diaPorExtenso(quando: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, day: 'numeric', month: 'long' }).format(
    quando,
  );
}

function apoioDoGasto(perfil: PerfilDoCliente): string {
  if (perfil.atendimentos === 0) return 'Nenhum atendimento concluído';
  return `em ${plural(perfil.atendimentos, 'atendimento', 'atendimentos')}`;
}

function apoioDoRitmo(perfil: PerfilDoCliente, timeZone: string): string {
  if (perfil.ultimaVisita === null) return 'Ainda não veio';
  return `última visita em ${diaPorExtenso(perfil.ultimaVisita, timeZone)}`;
}

/**
 * O apoio da falta mostra o denominador, porque é ele que dá sentido à taxa:
 * "20%" de duas idas e "20%" de vinte são confianças diferentes.
 */
function apoioDaFalta(perfil: PerfilDoCliente): string {
  const marcados = perfil.atendimentos + perfil.faltas;
  if (marcados === 0) return 'Ainda não há do que tirar taxa';
  const emMarcados = plural(marcados, 'horário marcado', 'horários marcados');
  if (perfil.faltas === 0) return `nenhuma falta em ${emMarcados}`;
  return `${plural(perfil.faltas, 'falta', 'faltas')} de ${emMarcados}`;
}

export function IndicadoresDoCliente({
  perfil,
  timeZone,
  className,
  ...resto
}: IndicadoresDoClienteProps) {
  return (
    <div
      data-slot="indicadores-do-cliente"
      className={cn(indicadoresDoClienteVariants(), className)}
      {...resto}
    >
      <CartaoIndicador
        titulo="Total gasto"
        // `formatMoney` e não `formatPrice`: aquele devolve "Grátis" no zero, que
        // é certo para preço de serviço e absurdo em "total gasto". Com centavo,
        // e não arredondado como o resumo, porque este número o dono confere
        // contra as linhas do histórico logo abaixo, que mostram centavo.
        valor={formatMoney(perfil.totalGastoCents)}
        apoio={apoioDoGasto(perfil)}
        explicacao="Soma do preço dos atendimentos que ele já fez, com o preço congelado no momento do agendamento. Horário agendado do futuro não entra, porque ainda não aconteceu; falta também não, porque a cadeira ficou parada e ninguém pagou."
      />

      <CartaoIndicador
        titulo="Corta a cada"
        valor={
          perfil.intervaloTipico === null ? TRACO : plural(perfil.intervaloTipico, 'dia', 'dias')
        }
        apoio={apoioDoRitmo(perfil, timeZone)}
        explicacao="A mediana dos intervalos entre as visitas dele — o valor do meio, não a média. Com intervalos de 15, 15, 15 e 90 dias a média daria 34 e esconderia o sumiço; a mediana devolve os 15, que são o ritmo de verdade. Corte e barba no mesmo dia contam como uma ida só. Com menos de duas visitas não há intervalo, e aí não há ritmo."
      />

      <CartaoIndicador
        titulo="Faltas"
        valor={perfil.taxaDeFalta === null ? TRACO : formatPercent(perfil.taxaDeFalta)}
        apoio={apoioDaFalta(perfil)}
        explicacao="Faltas ÷ (atendidos + faltas). Cancelado fica de fora do divisor: quem cancela devolve o horário para a grade, quem falta deixa a cadeira parada. Sem nenhum atendido e nenhuma falta não há do que tirar taxa — e aí o cartão mostra traço, que é diferente de 0%."
      />

      <CartaoIndicador
        titulo="Preferidos"
        // O único valor desta fileira que não é número, e o único que vem do
        // cadastro da loja: "Pigmentação" tem 11 letras e nos 34px do valor pesa
        // mais que a largura do cartão. Sem a quebra o `overflow-hidden` do
        // `Card` **corta** a palavra em silêncio — trocar letra perdida por uma
        // segunda linha é o negócio bom.
        className="[&_[data-slot=cartao-indicador-valor]]:break-words"
        valor={perfil.servicoPreferido ?? TRACO}
        apoio={
          perfil.barbeiroPreferido ? `com ${perfil.barbeiroPreferido}` : 'Sem barbeiro preferido'
        }
        explicacao="O serviço e o barbeiro que mais se repetem entre os atendimentos concluídos. Empate não elege: quem fez um corte e uma barba não tem preferido, e inventar um por ordem de chegada é o tipo de detalhe que o dono confere na hora e não perdoa."
      />
    </div>
  );
}
