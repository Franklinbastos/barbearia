'use client';

import { useActionState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Textarea } from '@/components/ui/textarea';
import { saveCustomerNotesAction, type NotesState } from '../actions';

const ESTADO_INICIAL: NotesState = {};

export function NotesForm({ customerId, notes }: { customerId: string; notes: string | null }) {
  const action = saveCustomerNotesAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex max-w-[520px] flex-col gap-3">
      <Campo rotulo="Notas" dica="Só a equipe vê. O cliente nunca.">
        {/* `py-2` saiu: o `Textarea` da lib já traz o recheio vertical, a borda
            e o raio. `rows` continua sendo o piso de quatro linhas para quem não
            tem `field-sizing: content`; onde tem, o campo cresce com a nota. */}
        <Textarea name="notes" defaultValue={notes ?? ''} rows={4} />
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
