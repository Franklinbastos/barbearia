'use client';

import { useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { toggleStaffAction } from './actions';

export function ToggleStaffButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Botao
        type="button"
        variante="secundario"
        pendente={pending}
        onClick={() => {
          setErro(null);
          startTransition(() => executarAcao(() => toggleStaffAction(id, !active), setErro));
        }}
        className="min-h-11 w-full min-w-22"
      >
        {active ? 'Desativar' : 'Ativar'}
      </Botao>
      <ErroDeAcao mensagem={erro} />
    </div>
  );
}
