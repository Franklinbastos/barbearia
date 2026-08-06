'use client';

import { useTransition } from 'react';
import { toggleStaffAction } from './actions';

export function ToggleStaffButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleStaffAction(id, !active))}
    >
      {active ? 'Desativar' : 'Ativar'}
    </button>
  );
}
