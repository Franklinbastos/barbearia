'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { saveServiceAction, type ServiceFormState } from './actions';

const ESTADO_INICIAL: ServiceFormState = {};

/**
 * As durações que cobrem quase todo cadastro de barbearia. Existem para que o
 * caso comum não passe pela roleta do `input type="number"` do celular, que
 * custa dois toques precisos com o dedo com talco.
 */
const DURACOES_COMUNS = [15, 30, 45];

export function ServicoForm() {
  const [state, formAction, pending] = useActionState(saveServiceAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [aberto, setAberto] = useState(false);
  const [duracao, setDuracao] = useState('');

  // Ajuste de estado durante a renderização, não em efeito: é o padrão do React
  // para "estado que precisa mudar quando uma prop/estado externo muda", e aqui
  // o externo é a resposta da action.
  //
  // A comparação é pela identidade de `state`, não por `state.ok`: a action
  // devolve um `{ ok: true }` novo a cada acerto, mas o booleano continua
  // `true` — comparando o booleano, o segundo serviço seguido ficaria com a
  // duração do primeiro no campo.
  const [respostaJaTratada, setRespostaJaTratada] = useState(state);
  if (respostaJaTratada !== state) {
    setRespostaJaTratada(state);
    if (state.ok) setDuracao('');
  }

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  if (!aberto) {
    return (
      <Botao
        type="button"
        variante="secundario"
        largura="total"
        onClick={() => setAberto(true)}
        className="md:w-auto"
      >
        Adicionar serviço
      </Botao>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex max-w-[520px] flex-col gap-3 rounded-cx border border-linha bg-superficie p-3"
    >
      <Campo rotulo="Nome">
        <input name="name" required minLength={2} autoComplete="off" />
      </Campo>

      <div className="flex flex-col gap-1.5">
        <div role="group" aria-label="Durações mais usadas" className="flex flex-wrap gap-2">
          {DURACOES_COMUNS.map((minutos) => {
            const escolhida = duracao === String(minutos);
            return (
              <Botao
                key={minutos}
                type="button"
                variante="secundario"
                aria-pressed={escolhida}
                aria-label={`${minutos} min`}
                onClick={() => setDuracao(String(minutos))}
                // 48px é a medida da ficha na §3.6; a altura de 52px do botão é
                // do verbo da tela, e ficha não é verbo.
                className={`min-h-12 min-w-16 ${escolhida ? 'border-2 border-tinta font-bold' : ''}`}
              >
                {minutos}
              </Botao>
            );
          })}
        </div>

        <Campo rotulo="Duração (min)">
          <input
            name="durationMinutes"
            type="number"
            inputMode="numeric"
            required
            min={1}
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
          />
        </Campo>
      </div>

      <Campo rotulo="Preço" prefixo="R$">
        <input name="priceCents" required inputMode="decimal" placeholder="40,00" />
      </Campo>

      <ErroDeAcao mensagem={state.erro} />

      <Botao type="submit" largura="total" pendente={pending} rotuloPendente="Salvando…">
        Adicionar serviço
      </Botao>

      {/* "Fechar", nunca "Cancelar": neste produto cancelar é desmarcar o
          horário de um cliente, e a palavra não pode significar duas coisas. */}
      <Botao
        type="button"
        variante="texto"
        className="min-h-12 self-center"
        onClick={() => setAberto(false)}
      >
        Fechar
      </Botao>
    </form>
  );
}
