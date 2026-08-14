'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Card, CardContent } from '@/components/ui/card';
import { larguraVariants } from '@/components/ui/largura';
import { cn } from '@/lib/utils';
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
      // Quem segura a largura é o `self-start`, não o `md:w-auto` — e a
      // armadilha vale guardar. Este botão nasce filho direto de um
      // `flex flex-col` (a `<Largura>` da tela) e num flex-column o filho
      // estica na transversal por `align-items: stretch`. O detalhe é que o
      // stretch só age quando a largura é `auto`: `md:w-auto` pedia justamente
      // a condição que faz o stretch valer, então o botão saía com os 880px da
      // tela inteira em vez do tamanho do texto. Quem desliga o stretch é o
      // `align-self`, e ele fica aqui de propósito — a tela que renderiza este
      // formulário não precisa lembrar de nada. No celular nada muda: o
      // `largura="total"` continua mandando.
      <Botao
        type="button"
        variante="secundario"
        largura="total"
        onClick={() => setAberto(true)}
        className="self-start md:w-auto"
      >
        Adicionar serviço
      </Botao>
    );
  }

  return (
    // A caixa do formulário já era um card desenhado à mão — mesmo fundo, mesmo
    // raio. Vira o card da lib para não conviver com a lista logo abaixo tendo
    // borda dura enquanto ela tem anel.
    //
    // O card não tem largura própria: herda a da tela, que é a mesma da lista
    // logo abaixo (§3.7) — 520 do formulário empilhado sobre 720 da lista era o
    // degrau visível na primeira dobra. O teto de `formulario` desceu para os
    // campos, que é onde ele quer dizer alguma coisa: linha de input larga
    // demais faz o olho perder o começo ao voltar.
    <Card>
      <CardContent>
        <form
          ref={formRef}
          action={formAction}
          className={cn(larguraVariants({ tipo: 'formulario' }), 'flex flex-col gap-3')}
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
      </CardContent>
    </Card>
  );
}
