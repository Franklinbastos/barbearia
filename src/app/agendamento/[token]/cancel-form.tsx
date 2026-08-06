'use client';

import { useActionState } from 'react';
import { cancelByTokenAction, type CancelState } from './actions';

const ESTADO_INICIAL: CancelState = {};

export function CancelForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(cancelByTokenAction, ESTADO_INICIAL);

  if (state.cancelado) {
    return <p>Agendamento cancelado.</p>;
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm('Cancelar este horário?')) e.preventDefault();
      }}
    >
      <input type="hidden" name="token" value={token} />
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Cancelando…' : 'Cancelar meu horário'}
      </button>
    </form>
  );
}
