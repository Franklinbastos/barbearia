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

const BLOCOS_POR_DIA = 3;

/**
 * Nome acessível de um campo de hora.
 *
 * São sete formulários iguais na mesma tela, 42 campos ao todo. Sem isto o
 * leitor de tela anuncia "hora" quarenta e duas vezes e não há como saber em
 * qual dia — nem em qual ponta do bloco — o cursor está.
 */
export function rotuloDoCampoDeHora(
  weekday: number,
  bloco: number,
  extremo: 'start' | 'end',
): string {
  const ponta = extremo === 'start' ? 'início' : 'fim';
  return `${NOMES_DIA[weekday]} — ${ponta} do bloco ${bloco + 1}`;
}

/** Confirmação que diz **qual** dia foi salvo — sete formulários irmãos na mesma tela. */
export function mensagemDeExpedienteSalvo(weekday: number): string {
  return `Expediente de ${NOMES_DIA[weekday].toLowerCase()} salvo.`;
}

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
  const slots = Array.from(
    { length: BLOCOS_POR_DIA },
    (_, i) => blocos[i] ?? { startTime: '', endTime: '' },
  );

  return (
    <form action={formAction} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="weekday" value={weekday} />
      <span style={{ width: '5rem' }}>{NOMES_DIA[weekday]}</span>
      {slots.map((bloco, i) => (
        <span key={i} style={{ display: 'flex', gap: '0.25rem' }}>
          <input
            type="time"
            name={`block${i + 1}_start`}
            aria-label={rotuloDoCampoDeHora(weekday, i, 'start')}
            defaultValue={paraHoraInput(bloco.startTime)}
          />
          <input
            type="time"
            name={`block${i + 1}_end`}
            aria-label={rotuloDoCampoDeHora(weekday, i, 'end')}
            defaultValue={paraHoraInput(bloco.endTime)}
          />
        </span>
      ))}
      <button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar'}
      </button>
      {state.erro ? <span role="alert" style={{ color: 'crimson' }}>{state.erro}</span> : null}
      {state.ok ? <span role="status">{mensagemDeExpedienteSalvo(weekday)}</span> : null}
    </form>
  );
}
