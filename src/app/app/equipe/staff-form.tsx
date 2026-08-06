'use client';

import { useActionState, useRef, useEffect } from 'react';
import { createStaffAction, type StaffFormState } from './actions';

const ESTADO_INICIAL: StaffFormState = {};

export function StaffForm() {
  const [state, formAction, pending] = useActionState(createStaffAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
      <label>
        Nome do barbeiro
        <input name="name" required minLength={2} />
      </label>
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Adicionar barbeiro'}
      </button>
    </form>
  );
}
