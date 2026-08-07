'use client';

import { useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { toggleStaffAction } from './actions';

export function ToggleStaffButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErro(null);
          startTransition(() => executarAcao(() => toggleStaffAction(id, !active), setErro));
        }}
      >
        {active ? 'Desativar' : 'Ativar'}
      </button>
      <ErroDeAcao mensagem={erro} />
    </>
  );
}
