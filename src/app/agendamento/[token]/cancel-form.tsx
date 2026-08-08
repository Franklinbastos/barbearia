'use client';

import { useActionState, useRef } from 'react';
import { Bloco } from '@/components/ui/bloco';
import { BotaoDeConfirmacao } from '@/components/ui/botao-de-confirmacao';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { cancelByTokenAction, type CancelState } from './actions';

const ESTADO_INICIAL: CancelState = {};

/**
 * Cancelamento pelo link do cliente (§5.6 da direção de UI).
 *
 * O `confirm()` do navegador morreu aqui: não é estilizável, chega em inglês em
 * parte dos aparelhos e some sob a WebView do WhatsApp — que é justamente de
 * onde o cliente abre este link. No lugar, dois toques no próprio botão.
 */
export function CancelForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(cancelByTokenAction, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  if (state.cancelado) {
    return <Bloco papel="status">Agendamento cancelado.</Bloco>;
  }

  return (
    <form ref={formulario} action={formAction}>
      <input type="hidden" name="token" value={token} />
      <ErroDeAcao mensagem={state.erro} />
      <BotaoDeConfirmacao
        rotulo="Cancelar meu horário"
        rotuloConfirmar="Confirmar cancelamento"
        rotuloPendente="Cancelando…"
        pendente={pending}
        aoConfirmar={() => formulario.current?.requestSubmit()}
      />
    </form>
  );
}
