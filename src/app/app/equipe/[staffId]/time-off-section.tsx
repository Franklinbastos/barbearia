'use client';

import { useActionState, useRef, useEffect, useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import { createTimeOffAction, deleteTimeOffAction, type FormState } from './actions';

const ESTADO_INICIAL: FormState = {};

type Bloqueio = { id: string; startAt: Date; endAt: Date; reason: string | null };

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

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex max-w-[720px] flex-col gap-3">
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
          Passa a ser o card da lib, como a lista acima. */}
      <Card className="max-w-[520px]">
        <CardContent>
          <form ref={formRef} action={formAction} className="flex flex-col gap-3">
            <Campo rotulo="Data">
              <input type="date" name="date" required />
            </Campo>

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
