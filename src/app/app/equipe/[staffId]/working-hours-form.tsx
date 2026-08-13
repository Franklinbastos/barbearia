'use client';

import { Fragment, useActionState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Card, CardContent } from '@/components/ui/card';
import { saveWorkingHoursAction, type FormState } from './actions';

const ESTADO_INICIAL: FormState = {};

const NOMES_DIA: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
};

const BLOCOS_POR_DIA = 3;

/**
 * Nome acessível de um campo de hora.
 *
 * São sete formulários iguais na mesma tela, 42 campos ao todo. Sem isto o
 * leitor de tela anuncia "hora" quarenta e duas vezes e não há como saber em
 * qual dia — nem em qual ponta do bloco — o cursor está.
 */
export function rotuloDoCampoDeHora(
  weekday: number,
  bloco: number,
  extremo: 'start' | 'end',
): string {
  const ponta = extremo === 'start' ? 'início' : 'fim';
  return `${NOMES_DIA[weekday]} — ${ponta} do bloco ${bloco + 1}`;
}

/** Confirmação que diz **qual** dia foi salvo — sete formulários irmãos na mesma tela. */
export function mensagemDeExpedienteSalvo(weekday: number): string {
  return `Expediente de ${NOMES_DIA[weekday].toLowerCase()} salvo.`;
}

function paraHoraInput(time: string) {
  return time.slice(0, 5);
}

const CAMPO_DE_HORA =
  'min-h-[var(--tap-md)] w-full rounded-cx border border-linha bg-bg px-2 text-base leading-6';

/**
 * O pior caso do painel hoje: seis `input type="time"` numa linha só, sete
 * formulários desses empilhados. Em 360px a linha passa de 600px e leva a tela
 * inteira junto.
 *
 * A grade é de três colunas — uma por bloco — preenchida **por coluna**: em
 * cima os três "início", embaixo os três "fim". Duas linhas de três, o DOM na
 * ordem em que se tabula (início e fim do mesmo bloco em sequência), e cada
 * campo continua com o `aria-label` que já dizia dia, ponta e bloco.
 */
export function WorkingHoursForm({
  staffId,
  weekday,
  blocos,
}: {
  staffId: string;
  weekday: number;
  blocos: Array<{ startTime: string; endTime: string }>;
}) {
  const action = saveWorkingHoursAction.bind(null, staffId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const slots = Array.from(
    { length: BLOCOS_POR_DIA },
    (_, i) => blocos[i] ?? { startTime: '', endTime: '' },
  );

  return (
    // Um card por dia da semana: são sete caixas empilhadas, e o anel do card
    // separa melhor do que a borda dura que estava aqui.
    <Card>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="weekday" value={weekday} />

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <strong className="text-[17px] leading-[22px] font-bold">{NOMES_DIA[weekday]}</strong>
            {/* Redundante para o leitor de tela — cada campo já diz "início do bloco
                2" —, mas é o que explica a grade para quem enxerga. */}
            <span aria-hidden="true" className="text-xs leading-4 text-tinta-3">
              início em cima, fim embaixo
            </span>
          </div>

          <div className="grid grid-flow-col grid-cols-3 grid-rows-2 gap-2">
            {slots.map((bloco, i) => (
              <Fragment key={i}>
                <input
                  type="time"
                  name={`block${i + 1}_start`}
                  aria-label={rotuloDoCampoDeHora(weekday, i, 'start')}
                  defaultValue={paraHoraInput(bloco.startTime)}
                  className={CAMPO_DE_HORA}
                />
                <input
                  type="time"
                  name={`block${i + 1}_end`}
                  aria-label={rotuloDoCampoDeHora(weekday, i, 'end')}
                  defaultValue={paraHoraInput(bloco.endTime)}
                  className={CAMPO_DE_HORA}
                />
              </Fragment>
            ))}
          </div>

          <ErroDeAcao mensagem={state.erro} />
          {state.ok ? (
            <p role="status" className="text-sm leading-5 text-ok">
              {mensagemDeExpedienteSalvo(weekday)}
            </p>
          ) : null}

          <Botao
            type="submit"
            variante="secundario"
            pendente={pending}
            rotuloPendente="Salvando…"
            className="self-end"
          >
            Salvar
          </Botao>
        </form>
      </CardContent>
    </Card>
  );
}
