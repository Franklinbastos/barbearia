'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';
import {
  CalendarClock,
  CalendarX,
  Check,
  MessageCircle,
  MoreHorizontal,
  Phone,
  User,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { telefoneParaWaMe } from '@/lib/telefone';
import { jaPodeFaltar } from './cartao-da-agenda';
import type { AgendaItem } from './day-grid';

/**
 * O `⋯` da linha do desktop e tudo que não coube nas colunas.
 *
 * **Só desktop.** No celular quem faz este papel é a `FolhaInferior` do
 * `CartaoDaAgenda`, que já existia e onde o WhatsApp e a ficha do cliente
 * entraram nesta mesma rodada. Folha de 560px no desktop para sete itens é
 * desperdício; menu suspenso no celular é alvo pequeno demais — são dois gestos
 * diferentes para o mesmo conteúdo, e cada tela usa o seu.
 *
 * **Por que "Compareceu" e "Não veio" estão aqui, se já estão na linha.** Na
 * linha eles recolhem para 60% e só sobem no ponteiro. O Polaris é explícito:
 * ação revelada no hover *"must also be accessible in another way"*. Este menu é
 * esse outro caminho — quem navega por Tab abre o `⋯` e encontra os dois verbos
 * escritos por extenso, sem depender de tooltip nem de mouse. É a correção de
 * acessibilidade que justifica o arquivo, e por isso ela é testada pelo teclado
 * (`Enter` no `⋯`, `↓`, `Enter`) e não por clique de mouse.
 *
 * **Os itens são `DropdownMenuItem` com `onClick`, nunca `<button>` dentro
 * deles.** O `Menu.Item` do base-ui renderiza um `<div role="menuitem">` e é ele
 * quem recebe o foco de teclado do menu; um botão aninhado fica fora do
 * percurso de setas, e o `Enter` dispara o `onClick` do item — que, sem esse
 * `onClick`, não faz nada. A primeira versão deste arquivo era assim: o menu
 * abria, "Compareceu" aparecia, e o teclado não marcava ninguém.
 */

export type MenuDaLinhaProps = ComponentProps<'div'> & {
  item: AgendaItem;
  pendente: boolean;
  onMarcar: (status: 'DONE' | 'NO_SHOW' | 'CANCELED') => void;
  /** Ausente ⇒ "Remarcar" nasce desabilitado. A Task 4 passa a função. */
  onRemarcar?: () => void;
  /** Injetado pelo pai: UM `setInterval` de 60s alimenta a lista inteira. */
  agora: Date;
};

/** 32px — alvo de ponteiro no desktop (a WCAG 2.2 pede 24). */
const ALVO_32 =
  'inline-flex size-8 items-center justify-center rounded-md border border-linha transition-colors hover:bg-superficie-2 disabled:opacity-50';

export function MenuDaLinha({
  item,
  pendente,
  onMarcar,
  onRemarcar,
  agora,
  className,
  ...resto
}: MenuDaLinhaProps) {
  const [aberto, setAberto] = useState(false);
  // O "Cancelar" arma dentro do menu, como arma dentro da folha do celular:
  // duas batidas para o que não tem volta. Fechar o menu desarma — menu que
  // reabre já armado é o desastre esperando a mão errada.
  const [cancelamentoArmado, setCancelamentoArmado] = useState(false);

  const agendado = item.status === 'BOOKED';
  const podeFaltar = jaPodeFaltar(item, agora);
  const whatsapp = `https://wa.me/${telefoneParaWaMe(item.customerPhone)}`;

  // Vinte atendimentos no dia são vinte botões chamados "Mais ações", e quem usa
  // leitor de tela ouve só o rótulo. A frase é **a mesma** do `⋯` do cartão do
  // celular de propósito: é a mesma afordância, em duas telas.
  const rotuloDoMais = `Mais ações para ${item.customerName}`;

  function aoAbrirOuFechar(proximo: boolean) {
    setAberto(proximo);
    if (!proximo) setCancelamentoArmado(false);
  }

  return (
    <div data-slot="menu-da-linha" {...resto} className={className}>
      <DropdownMenu open={aberto} onOpenChange={aoAbrirOuFechar}>
        <DropdownMenuTrigger
          render={
            <button type="button" aria-label={rotuloDoMais} className={ALVO_32}>
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </button>
          }
        />

        <DropdownMenuContent align="end" className="w-56">
          {agendado ? (
            <>
              <DropdownMenuItem disabled={pendente} onClick={() => onMarcar('DONE')}>
                <Check aria-hidden="true" />
                Compareceu
              </DropdownMenuItem>

              {/* Antes dos 10 minutos o "não veio" não existe em lugar nenhum do
                  produto — nem na linha, nem na folha do celular. Aqui também
                  não: item desabilitado que só some sozinho depois de um tempo
                  ensina menos que item que ainda não está lá. */}
              {podeFaltar ? (
                <DropdownMenuItem disabled={pendente} onClick={() => onMarcar('NO_SHOW')}>
                  <X aria-hidden="true" />
                  Não veio
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuItem disabled={!onRemarcar || pendente} onClick={onRemarcar}>
                <CalendarClock aria-hidden="true" />
                Remarcar
              </DropdownMenuItem>

              <DropdownMenuSeparator />
            </>
          ) : null}

          {/* Estes três valem para o atendimento cancelado e para o já
              atendido: o dono liga para quem faltou tanto quanto para quem vem. */}
          <DropdownMenuItem
            render={
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                Abrir no WhatsApp
              </a>
            }
          />

          <DropdownMenuItem
            render={
              <Link href={`/app/clientes/${item.customerId}`}>
                <User aria-hidden="true" />
                Ver ficha do cliente
              </Link>
            }
          />

          <DropdownMenuItem
            render={
              <a href={`tel:${item.customerPhone}`}>
                <Phone aria-hidden="true" />
                Ligar para o cliente
              </a>
            }
          />

          {agendado ? (
            <>
              <DropdownMenuSeparator />
              {/* `closeOnClick` só na segunda batida: fechar o menu na primeira
                  jogaria fora o estado armado e o segundo clique nunca chegaria.

                  Sem o desarme por tempo que a folha do celular tem: aqui o foco
                  fica no próprio item entre as duas batidas, e rótulo que muda
                  sozinho debaixo do cursor troca "Cancelar" por "Confirmar" na
                  hora errada. Quem fecha o menu já desarma. */}
              <DropdownMenuItem
                variant="destructive"
                disabled={pendente}
                closeOnClick={cancelamentoArmado}
                onClick={() =>
                  cancelamentoArmado ? onMarcar('CANCELED') : setCancelamentoArmado(true)
                }
              >
                <CalendarX aria-hidden="true" />
                {cancelamentoArmado ? 'Confirmar cancelamento' : 'Cancelar'}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
