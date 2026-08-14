'use client';

import { useActionState, useRef } from 'react';
import { Bloco } from '@/components/ui/bloco';
import { BotaoDeConfirmacao } from '@/components/ui/botao-de-confirmacao';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { anonymizeCustomerAction, type AnonymizeState } from '../actions';

const ESTADO_INICIAL: AnonymizeState = {};

/**
 * Só o primeiro nome no botão: "Remover os dados de Marcos Antônio da Silva"
 * quebra em três linhas no celular, e o nome inteiro está escrito no topo da
 * ficha, a uma rolada dali.
 */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

/**
 * Remoção dos dados pessoais do cliente, em dois toques.
 *
 * O que o `confirm()` explicava — que o histórico de atendimentos continua na
 * agenda — virou texto na tela: era a única informação que impedia o dono de
 * achar que estava apagando o passado da barbearia, e diálogo do navegador não
 * é lugar de guardar informação.
 *
 * **A confirmação nomeia o cliente.** "Confirmar remoção" não diz de quem, e é
 * a regra do NN/g para ação destrutiva: nomeie o objeto e rotule o botão com o
 * resultado, nunca com "Sim". Quem chega no segundo toque lê "Remover os dados
 * de Marcos" e sabe em qual ficha está.
 */
export function AnonymizeButton({ customerId, nome }: { customerId: string; nome: string }) {
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
        rotuloConfirmar={`Remover os dados de ${primeiroNome(nome)}`}
        rotuloPendente="Removendo…"
        pendente={pending}
        aoConfirmar={() => formulario.current?.requestSubmit()}
      />
    </form>
  );
}
