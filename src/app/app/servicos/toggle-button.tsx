'use client';

import { useTransition } from 'react';
import { toggleServiceAction } from './actions';

export function ToggleButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleServiceAction(id, !active))}
    >
      {active ? 'Desativar' : 'Ativar'}
    </button>
  );
}
