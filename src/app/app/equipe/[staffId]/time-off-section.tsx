'use client';

import { useActionState, useRef, useEffect, useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
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
  }, [state.ok]);

  return (
    <div>
      <ul>
        {bloqueios.map((b) => (
          <li key={b.id}>
            {formatDateTime(b.startAt, timeZone)} até {formatDateTime(b.endAt, timeZone)}
            {b.reason ? ` — ${b.reason}` : ''}{' '}
            <button
              type="button"
              disabled={excluindoPending}
              onClick={() => {
                setErroAoExcluir(null);
                startExcluindo(() =>
                  executarAcao(() => deleteTimeOffAction(staffId, b.id), setErroAoExcluir),
                );
              }}
            >
              Remover
            </button>
          </li>
        ))}
        {bloqueios.length === 0 ? <li>Nenhum bloqueio futuro.</li> : null}
      </ul>
      <ErroDeAcao mensagem={erroAoExcluir} />
      <form ref={formRef} action={formAction} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <label>
          Data
          <input type="date" name="date" required />
        </label>
        <label>
          Início
          <input type="time" name="startTime" required />
        </label>
        <label>
          Fim
          <input type="time" name="endTime" required />
        </label>
        <label>
          Motivo
          <input name="reason" placeholder="opcional" />
        </label>
        {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Bloquear horário'}
        </button>
      </form>
    </div>
  );
}
