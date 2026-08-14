'use client';

import { useActionState } from 'react';

import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Card, CardContent } from '@/components/ui/card';
import { larguraVariants } from '@/components/ui/largura';
import { cn } from '@/lib/utils';
import { saveCommissionAction, type FormState } from './actions';

const ESTADO_INICIAL: FormState = {};

/**
 * O único cadastro que a tela de indicadores pede (§4 do spec): um percentual
 * por barbeiro.
 *
 * **Vazio é uma resposta, e a dica precisa dizer isso.** O dono que não tira
 * comissão de si mesmo, ou o barbeiro que aluga a cadeira, deixa o campo em
 * branco e simplesmente não aparece no fechamento. Zero é outra coisa — é
 * "trabalha por comissão e a comissão é zero" —, e aparece zerado. Sem a frase
 * embaixo do campo, os dois pareceriam a mesma coisa e o dono digitaria `0`
 * para dizer "não tem", que é justamente o que enche o relatório de linha
 * zerada.
 *
 * O `%` é sufixo de verdade no `Campo`, não placeholder: quem usa lupa ou tema
 * de alto contraste continua vendo a unidade, e o campo recebe só o número.
 */
export function ComissaoForm({
  staffId,
  percentual,
}: {
  staffId: string;
  /** O que está gravado hoje. `null` = sem comissão. */
  percentual: number | null;
}) {
  const action = saveCommissionAction.bind(null, staffId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);

  return (
    // O card acompanha a largura da tela, dada uma vez em `page.tsx`; era ele o
    // bloco de 420px que destoava dos três irmãos. Quem fica estreito é o
    // *conteúdo*: `larguraVariants` dá o teto de formulário ao `<form>` sem
    // pendurar mais um `<div>` só para carregar uma classe.
    <Card>
      <CardContent>
        <form
          action={formAction}
          className={cn(larguraVariants({ tipo: 'formulario' }), 'flex flex-col gap-3')}
        >
          <Campo
            rotulo="Percentual de comissão"
            sufixo="%"
            dica="Vazio = sem comissão, e o barbeiro não entra no fechamento. Zero é diferente: entra, zerado."
          >
            <input
              type="number"
              name="commissionPercent"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              defaultValue={percentual ?? ''}
              placeholder="sem comissão"
            />
          </Campo>

          {/* Um lugar só para a mensagem — a do campo e a de permissão. Repetir
              o texto dentro do `Campo` faria o leitor de tela anunciar o mesmo
              erro duas vezes. */}
          <ErroDeAcao mensagem={state.erro} />

          {state.ok ? (
            <p role="status" className="text-sm leading-5 text-ok">
              Comissão salva.
            </p>
          ) : null}

          <Botao
            type="submit"
            variante="secundario"
            pendente={pending}
            rotuloPendente="Salvando…"
            className="self-end"
          >
            Salvar comissão
          </Botao>
        </form>
      </CardContent>
    </Card>
  );
}
