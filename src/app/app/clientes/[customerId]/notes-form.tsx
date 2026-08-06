'use client';

import { useActionState } from 'react';
import { saveCustomerNotesAction, type NotesState } from '../actions';

const ESTADO_INICIAL: NotesState = {};

export function NotesForm({ customerId, notes }: { customerId: string; notes: string | null }) {
  const action = saveCustomerNotesAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 420 }}>
      <label>
        Notas
        <textarea name="notes" defaultValue={notes ?? ''} rows={4} />
      </label>
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar notas'}
      </button>
    </form>
  );
}
