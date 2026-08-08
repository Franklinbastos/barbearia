'use client';

import { useActionState, useRef } from 'react';
import { Bloco } from '@/components/ui/bloco';
import { BotaoDeConfirmacao } from '@/components/ui/botao-de-confirmacao';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { anonymizeCustomerAction, type AnonymizeState } from '../actions';

const ESTADO_INICIAL: AnonymizeState = {};

/**
 * Remoção dos dados pessoais do cliente, em dois toques.
 *
 * O que o `confirm()` explicava — que o histórico de atendimentos continua na
 * agenda — virou texto na tela: era a única informação que impedia o dono de
 * achar que estava apagando o passado da barbearia, e diálogo do navegador não
 * é lugar de guardar informação.
 */
export function AnonymizeButton({ customerId }: { customerId: string }) {
  const action = anonymizeCustomerAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  if (state.ok) return <Bloco papel="status">Dados removidos.</Bloco>;

  return (
    <form ref={formulario} action={formAction} className="flex flex-col items-start gap-2">
      <p className="text-sm leading-5 text-tinta-2">
        O histórico de atendimentos continua na agenda.
      </p>
      <ErroDeAcao mensagem={state.erro} />
      <BotaoDeConfirmacao
        rotulo="Remover dados deste cliente"
        rotuloConfirmar="Confirmar remoção"
        rotuloPendente="Removendo…"
        pendente={pending}
        aoConfirmar={() => formulario.current?.requestSubmit()}
      />
    </form>
  );
}
