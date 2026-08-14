'use client';

import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { ptBR } from 'react-day-picker/locale';
import { useActionState, useRef, useEffect, useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Campo } from '@/components/ui/campo';
import { Card, CardContent } from '@/components/ui/card';
import { larguraVariants } from '@/components/ui/largura';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';
import { createTimeOffAction, deleteTimeOffAction, type FormState } from './actions';

const ESTADO_INICIAL: FormState = {};

type Bloqueio = { id: string; startAt: Date; endAt: Date; reason: string | null };

/**
 * `Date` local → `YYYY-MM-DD` pelo calendário local, nunca por UTC.
 *
 * `toISOString().slice(0, 10)` daria o dia em UTC, e a action monta o instante
 * com `DateTime.fromISO(\`${date}T${startTime}\`, { zone: loja.timeZone })` — um
 * bloqueio marcado à noite em São Paulo entraria no dia seguinte. O `Calendar`
 * devolve o dia que a pessoa tocou; o trabalho aqui é só copiá-lo sem
 * reinterpretar fuso nenhum.
 */
function dataParaISO(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

export function TimeOffSection({
  staffId,
  bloqueios,
  timeZone,
}: {
  staffId: string;
  bloqueios: Bloqueio[];
  timeZone: string;
}) {
  const action = createTimeOffAction.bind(null, staffId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [excluindoPending, startExcluindo] = useTransition();
  const [erroAoExcluir, setErroAoExcluir] = useState<string | null>(null);
  const [dia, setDia] = useState<Date | undefined>(undefined);
  const [calendarioAberto, setCalendarioAberto] = useState(false);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-3">
      {bloqueios.length === 0 ? (
        <Bloco>Nenhum bloqueio futuro.</Bloco>
      ) : (
        // A lista de bloqueios é conteúdo; o "Nenhum bloqueio futuro" acima
        // continua sendo `Bloco`, que é mensagem.
        <Card className="gap-0 py-0">
          <ul className="lista border-t-0 [&>li:last-child]:border-b-0">
            {bloqueios.map((b) => (
              <li key={b.id}>
                <div className="grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 p-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[17px] leading-[22px] font-bold">
                      {formatDateTime(b.startAt, timeZone)}
                    </span>
                    <span className="text-sm leading-5 text-tinta-2">
                      até {formatDateTime(b.endAt, timeZone)}
                      {b.reason ? ` — ${b.reason}` : ''}
                    </span>
                  </div>
                  <Botao
                    type="button"
                    variante="secundario"
                    pendente={excluindoPending}
                    aria-label={`Remover bloqueio de ${formatDateTime(b.startAt, timeZone)}`}
                    onClick={() => {
                      setErroAoExcluir(null);
                      startExcluindo(() =>
                        executarAcao(() => deleteTimeOffAction(staffId, b.id), setErroAoExcluir),
                      );
                    }}
                    className="min-h-11 min-w-22"
                  >
                    Remover
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ErroDeAcao mensagem={erroAoExcluir} />

      {/* A caixa do formulário já era um card à mão — mesmo fundo, mesmo raio.
          Passa a ser o card da lib, como a lista acima.

          O card não tem largura própria: herda a da tela, que é a mesma da lista
          logo acima (§3.7) — card de 520 embaixo de lista de 880 é o degrau que
          este plano inteiro veio desfazer. O teto de `formulario` desce para o
          `<form>`, que é onde ele quer dizer alguma coisa: linha de input larga
          demais faz o olho perder o começo ao voltar. É a mesma anatomia de
          `comissao-form`, `servico-form` e `staff-form`. */}
      <Card>
        <CardContent>
          {/* O dia escolhido mora em estado do React, e o `reset()` do efeito
              acima só limpa os `<input>` nativos. Pendurar a limpeza no evento
              `reset` do próprio formulário faz o calendário voltar a "Escolher
              data" pelo mesmo caminho que zera a hora e o motivo — sem um
              segundo `setState` dentro de efeito, que a regra
              `react-hooks/set-state-in-effect` (com razão) recusa. */}
          <form
            ref={formRef}
            action={formAction}
            onReset={() => setDia(undefined)}
            className={cn(larguraVariants({ tipo: 'formulario' }), 'flex flex-col gap-3')}
          >
            {/* O `Popover` envolve o `Campo` porque quem tem de ser o controle
                rotulado é o gatilho: o `Campo` clona o filho para pendurar
                nele o `id` que o `<label for>` aponta, e um `<Popover>` não
                renderiza elemento nenhum para receber esse id. */}
            <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
              <Campo rotulo="Data">
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {dia
                          ? format(dia, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : 'Escolher data'}
                      </span>
                      <CalendarDays aria-hidden="true" />
                    </Button>
                  }
                />
              </Campo>

              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  autoFocus
                  selected={dia}
                  defaultMonth={dia}
                  onSelect={(escolhido) => {
                    if (!escolhido) return;
                    setDia(escolhido);
                    setCalendarioAberto(false);
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* O que a action lê. Vazio ela devolve "Informe data e horários
                válidos", que é o mesmo caminho de quando a hora não vinha. */}
            <input type="hidden" name="date" value={dia ? dataParaISO(dia) : ''} readOnly />

            {/* Início e fim lado a lado: são duas horas do mesmo intervalo e
                cabem em 2 colunas mesmo em 360px. */}
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Início">
                <input type="time" name="startTime" required />
              </Campo>
              <Campo rotulo="Fim">
                <input type="time" name="endTime" required />
              </Campo>
            </div>

            <Campo rotulo="Motivo" dica="Opcional — aparece só para a equipe.">
              <input name="reason" autoComplete="off" />
            </Campo>

            <ErroDeAcao mensagem={state.erro} />

            <Botao type="submit" largura="total" pendente={pending} rotuloPendente="Salvando…">
              Bloquear horário
            </Botao>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
