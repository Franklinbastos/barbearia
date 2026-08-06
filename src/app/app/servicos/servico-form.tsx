'use client';

import { useActionState, useRef, useEffect } from 'react';
import { saveServiceAction, type ServiceFormState } from './actions';

const ESTADO_INICIAL: ServiceFormState = {};

export function ServicoForm() {
  const [state, formAction, pending] = useActionState(saveServiceAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
      <label>
        Nome
        <input name="name" required minLength={2} />
      </label>
      <label>
        Duração (min)
        <input name="durationMinutes" type="number" required min={1} />
      </label>
      <label>
        Preço
        <input name="priceCents" required placeholder="40,00" />
      </label>
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Adicionar serviço'}
      </button>
    </form>
  );
}
