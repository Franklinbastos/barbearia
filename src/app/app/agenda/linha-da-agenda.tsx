'use client';

import { cva } from 'class-variance-authority';
import { Check, X } from 'lucide-react';
import { useState, useTransition, type ComponentProps } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatAppointmentStatus, formatDuration, formatPrice, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VARIANTE_DO_ESTADO } from '../tom-do-estado';
import { setAppointmentStatusAction } from './actions';
import { MenuDaLinha } from './menu-da-linha';
import { useRemarcacao } from './remarcacao';
import {
  CONTORNO_DO_ESTADO,
  duracaoEmMinutos,
  estadoNaEtiquetaDe,
  jaPodeFaltar,
} from './cartao-da-agenda';
import type { AgendaItem } from './day-grid';

/**
 * O mesmo atendimento do `CartaoDaAgenda`, em colunas alinhadas — e só daqui
 * para cima (`md:`). No celular quem manda continua sendo o cartão: são dois
 * layouts de verdade, como o Compact do Outlook e o Mini do Todoist, e não um
 * esticado.
 *
 * Três decisões desta linha vieram da captura de tela de 15/08/2026, e nenhuma é
 * gosto:
 *
 * 1. **O fundo não diz estado.** Sai o verde do "compareceu" e o vermelho do
 *    "não veio" que o cartão pinta. O fundo é o canal do hover (Carbon manda o
 *    hover de linha estar sempre ligado, "as it can help the user visually scan
 *    the columns of data in a row"), a cor já é identidade do barbeiro (§3.5), e
 *    cor sozinha entrega 1 dos 3 portadores de estado que o Carbon exige. Quem
 *    diz o estado aqui é a etiqueta na coluna de x fixo, o contorno tracejado e
 *    o nome riscado no cancelado. Fundo pintado sobra para `--agora-bg`, que não
 *    é status: é "onde estamos no dia", é uma linha só e some sozinho.
 * 2. **A duração é número escrito, não altura.** Toda linha mede 48px — o
 *    "default" do Carbon, que também manda "use the same row height … don't mix
 *    row heights". A altura-por-duração do cartão faz sentido numa timeline; em
 *    colunas alinhadas ela quebra o ritmo de varredura sem entregar precisão.
 * 3. **O telefone sai.** Era ele que obrigava a terceira linha de conteúdo. Vive
 *    na ficha do cliente e na folha do "⋯".
 *
 * O que é regra — quando cabe um "não veio", qual contorno cada estado tem,
 * quanto dura o atendimento — mora no `cartao-da-agenda.tsx` e é importado. Dois
 * layouts é o preço aceito; duas verdades não era.
 */

/**
 * Os verbos ficam quietos em repouso e sobem a cheio no ponteiro **ou no foco**.
 * Duas coisas aqui não são gosto:
 *
 * 1. **60%, não zero.** Diferente do cartão, aqui o ícone não some: são dois
 *    alvos de 32px numa linha de 48, não dois botões de 400px. Responde aos dois
 *    lados do aviso do NN/g de uma vez — nem quarenta botões gritando, nem ação
 *    invisível em repouso.
 * 2. **`group-focus-within` junto com `group-hover`, sempre os dois.** Realce que
 *    só existe no ponteiro não existe para quem navega por Tab.
 */
const VERBOS_RECOLHEM = [
  'opacity-60 transition-opacity motion-reduce:transition-none',
  'group-hover:opacity-100 group-focus-within:opacity-100',
].join(' ');

/**
 * O `group` da raiz é o que faz `group-hover` e `group-focus-within` existirem
 * lá embaixo: tirar essa classe daqui é deixar os verbos em 60% para sempre.
 */
export const linhaDaAgendaVariants = cva('group border-l-4', {
  variants: {
    contorno: {
      cheio: 'border-solid',
      tracejado: 'border-dashed',
    },
  },
  defaultVariants: { contorno: 'cheio' },
});

export type LinhaDaAgendaProps = ComponentProps<'li'> & {
  item: AgendaItem;
  timeZone: string;
  /** String CSS pronta, de `cores-de-barbeiro.ts`. */
  corDoBarbeiro: string;
  /** Injetado pelo pai: UM `setInterval` de 60s alimenta a lista inteira. */
  agora: Date;
};

/** Ícone-botão de 32px: alvo de ponteiro no desktop (a WCAG 2.2 pede 24). */
const ALVO_32 = 'inline-flex size-8 items-center justify-center rounded-md transition-colors';

export function LinhaDaAgenda({
  item,
  timeZone,
  corDoBarbeiro,
  agora,
  className,
  ...resto
}: LinhaDaAgendaProps) {
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  // O mesmo `useRemarcacao` que a lista usa. Assinar o canal na mão aqui era
  // uma segunda cópia do hook — e a cópia ainda nascia `null`, o que obrigava um
  // `?.` em cima de um objeto que sempre existe.
  const remarcacao = useRemarcacao();

  function marcar(status: 'DONE' | 'NO_SHOW' | 'CANCELED') {
    setErro(null);
    iniciarTransicao(async () => {
      await executarAcao(() => setAppointmentStatusAction(item.id, status), setErro);
    });
  }

  function entrarModoRemarcacao() {
    remarcacao.entrar(item.id, item.customerName);
  }

  const cancelado = item.status === 'CANCELED';
  const podeFaltar = jaPodeFaltar(item, agora);
  const estadoNaEtiqueta = estadoNaEtiquetaDe(item.status);
  const acontecendoAgora =
    agora.getTime() >= item.startAt.getTime() && agora.getTime() < item.endAt.getTime();

  return (
    <li
      {...resto}
      data-slot="linha-da-agenda"
      className={cn(
        linhaDaAgendaVariants({ contorno: CONTORNO_DO_ESTADO[item.status] }),
        // O hover da linha só existe porque o fundo ficou livre — é o item 1 do
        // cabeçalho deste arquivo virando pixel.
        acontecendoAgora ? 'bg-agora-bg' : 'hover:bg-superficie',
        className,
      )}
      // A aresta é do barbeiro nos quatro estados (§3.5): o desfecho se lê no
      // contorno (cheio contra tracejado), não numa segunda cor.
      style={{ borderLeftColor: corDoBarbeiro }}
    >
      {/* 880 − 4 de aresta − 24 de recheio = 852 úteis, com seis vãos de 12px. A
          altura mora aqui, e não na raiz, para que a mensagem de erro possa
          crescer embaixo sem espremer as colunas. */}
      <div
        data-slot="colunas-da-linha"
        className="grid h-12 grid-cols-[72px_1.3fr_1fr_116px_76px_92px_108px] items-center gap-x-3 px-3"
      >
        <div className="min-w-0">
          <div className="text-base leading-6 font-bold tabular-nums">
            {formatTime(item.startAt, timeZone)}
          </div>
          {/* A duração escrita é o que substitui a altura variável do cartão. */}
          <div className="text-xs leading-4 text-tinta-3">
            {formatDuration(duracaoEmMinutos(item))}
          </div>
        </div>

        <div
          data-slot="cliente-da-linha"
          className={cn(
            'min-w-0 truncate text-[15px] leading-5 font-semibold',
            // Riscar o nome é o que faz o cancelado se ler sem cor nenhuma.
            cancelado && 'text-tinta-3 line-through',
          )}
        >
          {item.customerName}
        </div>

        <div data-slot="servico-da-linha" className="min-w-0 truncate text-sm leading-5 text-tinta-2">
          {item.serviceName}
        </div>

        <div data-slot="barbeiro-da-linha" className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: corDoBarbeiro }}
          />
          <span className="min-w-0 truncate text-sm leading-5">{item.staffName}</span>
        </div>

        {/* Número à direita é o alinhamento do Polaris para valor comparável. */}
        <div data-slot="preco-da-linha" className="text-right text-sm leading-5 tabular-nums">
          {formatPrice(item.servicePriceCents)}
        </div>

        {/* Coluna de x fixo: é o que corrige a etiqueta errante, que aparecia
            ora colada no nome, ora no canto oposto da mesma tela. */}
        <div data-slot="estado-da-linha">
          {estadoNaEtiqueta ? (
            <Badge variant={VARIANTE_DO_ESTADO[estadoNaEtiqueta]}>
              {formatAppointmentStatus(estadoNaEtiqueta)}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-1">
          {item.status === 'BOOKED' ? (
            <TooltipProvider>
              <div
                data-slot="verbos-da-linha"
                className={cn('flex items-center gap-1', VERBOS_RECOLHEM)}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        disabled={pendente}
                        onClick={() => marcar('DONE')}
                        // O nome do cliente entra no rótulo porque num dia de
                        // vinte atendimentos vinte botões chamados "Compareceu"
                        // deixam quem usa leitor de tela sem saber de quem é cada
                        // um. O verbo vem primeiro: é por ele que se procura.
                        aria-label={`Compareceu · ${item.customerName}`}
                        className={cn(ALVO_32, 'hover:bg-ok-bg disabled:opacity-50')}
                      />
                    }
                  >
                    <Check aria-hidden="true" className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>Compareceu</TooltipContent>
                </Tooltip>

                {podeFaltar ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          disabled={pendente}
                          onClick={() => marcar('NO_SHOW')}
                          aria-label={`Não veio · ${item.customerName}`}
                          className={cn(ALVO_32, 'hover:bg-perigo-bg disabled:opacity-50')}
                        />
                      }
                    >
                      <X aria-hidden="true" className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>Não veio</TooltipContent>
                  </Tooltip>
                ) : (
                  // Enquanto "Não veio" não pode aparecer, a célula guarda os
                  // 32px dele: sem isso o "Compareceu" anda para a direita às
                  // 9h10 e a coluna dança linha a linha.
                  <span aria-hidden="true" className="size-8" />
                )}
              </div>
            </TooltipProvider>
          ) : null}

          {/* Carbon: "the overflow menu icons are persistent on each row". É a
              afordância mínima da linha, e por isso nunca recolhe.

              O conteúdo dele — "Compareceu" para quem não tem ponteiro, o
              WhatsApp, a ficha do cliente, o telefone que saiu daqui e o
              cancelamento em dois tempos — mora no `menu-da-linha`.

              O `onRemarcar` é o único gatilho do modo de remarcação em todo o
              produto, e é por isso que ele só existe no desktop: abaixo de 768px
              esta linha nem renderiza. */}
          <MenuDaLinha
            item={item}
            pendente={pendente}
            onMarcar={marcar}
            onRemarcar={entrarModoRemarcacao}
            agora={agora}
            className="hidden md:block"
          />
        </div>
      </div>

      <ErroDeAcao mensagem={erro} />
    </li>
  );
}
