'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * A barra de data da agenda (§5.7, item 2).
 *
 * Fica grudada no topo porque a lista é longa e "que dia é este?" é a pergunta
 * que se faz no meio da rolagem. As setas são `<Link>` do Next e não `<a href>`
 * cru: na tela mais aberta do produto, recarregar o documento inteiro para
 * andar um dia muda a sensação de velocidade.
 *
 * A legenda de contagem substitui a faixa de quatro blocos de resumo: 64px da
 * primeira dobra para um filtro que ninguém usa com cliente esperando é enfeite
 * que custa rolagem. E nunca diz "HOJE" — a barra navega para qualquer dia, e o
 * rótulo mentiria.
 */
export type BarraDeDataProps = {
  dataISO: string;
  hojeISO: string;
  contagens: { total: number; aAtender: number };
};

/** Alvo de 44px da barra — a altura é do controle, não de quem o usa. */
const ALVO_44 =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r)] ' +
  'border border-linha bg-bg text-tinta no-underline';

function deslocarDia(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(ano, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function Seta({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="text-[20px] leading-none">
      {children}
    </span>
  );
}

export function BarraDeData({ dataISO, hojeISO, contagens }: BarraDeDataProps) {
  const ontem = deslocarDia(dataISO, -1);
  const amanha = deslocarDia(dataISO, 1);
  const eHoje = dataISO === hojeISO;

  return (
    <div className="-mx-3 mb-2 md:-mx-5">
      <div
        className="sticky top-0 z-10 flex h-16 flex-col justify-center gap-1 bg-bg px-3 md:px-5"
        style={{ borderBottom: '1px solid var(--linha)' }}
      >
        <div className="grid h-11 grid-cols-[44px_1fr_44px_44px] items-center gap-2">
          <Link href={`/app/agenda?data=${ontem}`} aria-label="Ontem" className={ALVO_44}>
            <Seta>‹</Seta>
          </Link>

          <form action="/app/agenda" method="get" className="contents">
            <input
              type="date"
              name="data"
              aria-label="Data"
              defaultValue={dataISO}
              key={dataISO}
              className="h-11 w-full rounded-[var(--r)] border border-linha bg-bg px-2 text-[16px] leading-6"
            />
            <button type="submit" className={ALVO_44}>
              Ir
            </button>
          </form>

          <Link href={`/app/agenda?data=${amanha}`} aria-label="Amanhã" className={ALVO_44}>
            <Seta>›</Seta>
          </Link>
        </div>

        <p className="h-5 text-[12px] leading-4 font-bold tracking-wide text-tinta-3 uppercase">
          {contagens.total} no dia · {contagens.aAtender} a atender
        </p>
      </div>

      {eHoje ? null : (
        <div className="px-3 pt-2 md:px-5">
          <Link
            href="/app/agenda"
            className="btn btn--sec btn--tot min-h-10"
          >
            Voltar para hoje
          </Link>
        </div>
      )}
    </div>
  );
}
