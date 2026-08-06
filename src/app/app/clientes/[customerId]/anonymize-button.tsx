'use client';

import { useActionState } from 'react';
import { anonymizeCustomerAction, type AnonymizeState } from '../actions';

const ESTADO_INICIAL: AnonymizeState = {};

export function AnonymizeButton({ customerId }: { customerId: string }) {
  const action = anonymizeCustomerAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);

  if (state.ok) return <p>Dados removidos.</p>;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm('Remover os dados pessoais deste cliente? O histórico de atendimentos continua na agenda.')) {
          e.preventDefault();
        }
      }}
    >
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Removendo…' : 'Remover dados deste cliente'}
      </button>
    </form>
  );
}
