import type { ReactNode } from 'react';

/**
 * Anatomia de topo das telas do painel: título, descrição e a ação principal.
 *
 * No celular a ação desce para baixo do título e ocupa a largura toda; a partir
 * de 768px sobe para a mesma linha do `<h1>`.
 */
export type CabecalhoDePaginaProps = {
  titulo: string;
  descricao?: string;
  /** ≥768px alinha na mesma linha do `<h1>`. */
  acao?: ReactNode;
};

export function CabecalhoDePagina({ titulo, descricao, acao }: CabecalhoDePaginaProps) {
  return (
    <header className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-7 font-bold">{titulo}</h1>
        {descricao ? <p className="text-base leading-6 text-tinta-2">{descricao}</p> : null}
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </header>
  );
}
