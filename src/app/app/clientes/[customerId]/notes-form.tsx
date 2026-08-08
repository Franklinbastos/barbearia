'use client';

import { useActionState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { saveCustomerNotesAction, type NotesState } from '../actions';

const ESTADO_INICIAL: NotesState = {};

export function NotesForm({ customerId, notes }: { customerId: string; notes: string | null }) {
  const action = saveCustomerNotesAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex max-w-[520px] flex-col gap-3">
      <Campo rotulo="Notas" dica="Só a equipe vê. O cliente nunca.">
        <textarea name="notes" defaultValue={notes ?? ''} rows={4} className="py-2" />
      </Campo>

      <ErroDeAcao mensagem={state.erro} />
      {state.ok ? (
        <p role="status" className="text-sm leading-5 text-ok">
          Notas salvas.
        </p>
      ) : null}

      <Botao
        type="submit"
        variante="secundario"
        pendente={pending}
        rotuloPendente="Salvando…"
        className="self-end"
      >
        Salvar notas
      </Botao>
    </form>
  );
}
