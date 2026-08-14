'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Bloco } from '@/components/ui/bloco';
import { Card } from '@/components/ui/card';
import { Segmentado } from '@/components/ui/segmentado';
import { formatAppointmentStatus, formatDateTime, formatPrice } from '@/lib/format';
import type { AppointmentStatus } from '@/lib/format';
import { VARIANTE_DO_ESTADO } from '../../tom-do-estado';

/**
 * O histórico do cliente com filtro de status — o padrão de Fresha e Square, e
 * a única coisa que todos os produtos do ramo têm nesta lista.
 *
 * **Não vira linha do tempo.** Nenhum concorrente desenhou timeline aqui, e o
 * que o dono lê é "quando, o quê, quanto, veio ou não" — isso é linha de lista,
 * a mesma de 72px que a ficha já tinha.
 *
 * **O filtro é estado de cliente, não querystring.** É leitura rápida durante um
 * atendimento ("esse aí já me deu bolo?"), não link para mandar para alguém — e
 * navegação de servidor a cada toque custaria um ida-e-volta para filtrar o que
 * já está na tela.
 *
 * **O vazio diz qual filtro está ligado.** "Nenhum atendimento ainda" é a frase
 * de quem nunca veio; dizê-la para quem veio dez vezes e nunca faltou seria
 * mentir. Por isso cada filtro tem a própria frase.
 */
export type AtendimentoDoHistorico = {
  id: string;
  startAt: Date;
  status: AppointmentStatus;
  serviceName: string;
  priceCents: number;
};

export type FiltroDoHistorico = 'todos' | 'concluidos' | 'faltas';

/**
 * Três opções, que é o teto do `Segmentado` — acima disso vira lista. Cancelado
 * fica fora de propósito: quem cancelou devolveu o horário, e o dono que abre a
 * ficha está atrás de duas coisas, o que ele já fez e o que ele deu de bolo.
 */
const OPCOES: { valor: FiltroDoHistorico; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'concluidos', rotulo: 'Concluídos' },
  { valor: 'faltas', rotulo: 'Faltas' },
];

const ESTADO_DO_FILTRO: Record<FiltroDoHistorico, AppointmentStatus | null> = {
  todos: null,
  concluidos: 'DONE',
  faltas: 'NO_SHOW',
};

const VAZIO: Record<FiltroDoHistorico, string> = {
  todos: 'Nenhum atendimento ainda.',
  concluidos: 'Nenhum atendimento concluído.',
  faltas: 'Nenhuma falta registrada.',
};

/**
 * A resposta do filtro para quem não enxerga a lista.
 *
 * O `aria-pressed` do segmentado anuncia qual botão ficou apertado e nada mais:
 * a lista encolhendo logo abaixo não faz barulho nenhum, e aí o filtro vira
 * controle sem resposta para quem usa leitor de tela. A linha é a mesma solução
 * do encaixe da agenda, e fica **sempre montada** de propósito — região viva que
 * nasce junto com o texto não é anunciada por todo leitor.
 */
function resumoDoFiltro(visiveis: number, filtro: FiltroDoHistorico, semNada: boolean): string {
  if (semNada) return '';
  if (visiveis === 0) return VAZIO[filtro];
  return visiveis === 1 ? '1 atendimento na lista.' : `${visiveis} atendimentos na lista.`;
}

export type HistoricoProps = {
  atendimentos: AtendimentoDoHistorico[];
  /** Fuso da barbearia — a hora nunca sai no fuso do servidor. */
  timeZone: string;
};

export function Historico({ atendimentos, timeZone }: HistoricoProps) {
  const [filtro, setFiltro] = useState<FiltroDoHistorico>('todos');

  const estado = ESTADO_DO_FILTRO[filtro];
  const visiveis = estado === null ? atendimentos : atendimentos.filter((a) => a.status === estado);

  // Sem nenhum atendimento não há o que filtrar: um segmentado de três botões em
  // cima de uma frase vazia é controle que não faz nada.
  const semNada = atendimentos.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {semNada ? null : (
        <Segmentado
          rotuloDoGrupo="Filtrar o histórico"
          opcoes={OPCOES}
          valor={filtro}
          aoTrocar={setFiltro}
        />
      )}

      <p role="status" className="sr-only">
        {resumoDoFiltro(visiveis.length, filtro, semNada)}
      </p>

      {visiveis.length === 0 ? (
        // O "Nenhum atendimento ainda" continua sendo `Bloco`, que é mensagem; o
        // card é caixa de conteúdo.
        <Bloco>{VAZIO[semNada ? 'todos' : filtro]}</Bloco>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="lista border-t-0 [&>li:last-child]:border-b-0">
            {visiveis.map((atendimento) => (
              <li key={atendimento.id}>
                <div className="grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 p-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[17px] leading-[22px] font-bold">
                      {formatDateTime(atendimento.startAt, timeZone)}
                    </span>
                    <span className="text-sm leading-5 text-tinta-2">
                      {atendimento.serviceName} · {formatPrice(atendimento.priceCents)}
                    </span>
                  </div>
                  {/* O `TOM_DO_ESTADO` de quatro tons desenhados à mão saiu: a
                      variante vem de `tom-do-estado.ts`, que o cartão da agenda
                      também lê — as duas telas discordavam sobre o "Não veio". */}
                  <Badge variant={VARIANTE_DO_ESTADO[atendimento.status]}>
                    {formatAppointmentStatus(atendimento.status)}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
