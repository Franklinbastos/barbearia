'use client';

import { useActionState } from 'react';
import { saveWorkingHoursAction, type FormState } from './actions';

const ESTADO_INICIAL: FormState = {};

const NOMES_DIA: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
};

function paraHoraInput(time: string) {
  return time.slice(0, 5);
}

export function WorkingHoursForm({
  staffId,
  weekday,
  blocos,
}: {
  staffId: string;
  weekday: number;
  blocos: Array<{ startTime: string; endTime: string }>;
}) {
  const action = saveWorkingHoursAction.bind(null, staffId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const slots = [0, 1, 2].map((i) => blocos[i] ?? { startTime: '', endTime: '' });

  return (
    <form action={formAction} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="weekday" value={weekday} />
      <span style={{ width: '5rem' }}>{NOMES_DIA[weekday]}</span>
      {slots.map((bloco, i) => (
        <span key={i} style={{ display: 'flex', gap: '0.25rem' }}>
          <input type="time" name={`block${i + 1}_start`} defaultValue={paraHoraInput(bloco.startTime)} />
          <input type="time" name={`block${i + 1}_end`} defaultValue={paraHoraInput(bloco.endTime)} />
        </span>
      ))}
      <button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar'}
      </button>
      {state.erro ? <span role="alert" style={{ color: 'crimson' }}>{state.erro}</span> : null}
    </form>
  );
}
