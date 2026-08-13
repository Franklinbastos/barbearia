import type { ComponentProps, ReactNode } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Anatomia de topo das telas do painel: título, descrição e a ação principal.
 *
 * No celular a ação desce para baixo do título e ocupa a largura toda; a partir
 * de 768px sobe para a mesma linha do `<h1>`.
 *
 * **Por que não veio do shadcn.** Não existe `page-header` no registry — o mais
 * perto é o `card-header`, que é cabeçalho de cartão e traz grade própria,
 * `card-action` posicionado e tipografia de 14px. Aqui o título é o `<h1>` da
 * página. A anatomia é que segue o padrão da casa: `cva`, `cn` e `data-slot`
 * nas três partes, para uma tela poder afastar a ação sem recopiar as classes.
 *
 * **Sem `'use client'`, de propósito.** As dez telas que o usam são Server
 * Components.
 */
export type CabecalhoDePaginaProps = Omit<ComponentProps<'header'>, 'children' | 'title'> & {
  titulo: string;
  descricao?: string;
  /** ≥768px alinha na mesma linha do `<h1>`. */
  acao?: ReactNode;
};

export const cabecalhoDePaginaVariants = cva(
  'mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6',
);

export function CabecalhoDePagina({
  titulo,
  descricao,
  acao,
  className,
  ...resto
}: CabecalhoDePaginaProps) {
  return (
    <header
      data-slot="cabecalho-de-pagina"
      className={cn(cabecalhoDePaginaVariants(), className)}
      {...resto}
    >
      <div data-slot="cabecalho-textos" className="flex flex-col gap-1">
        <h1 data-slot="cabecalho-titulo" className="text-[22px] leading-7 font-bold">
          {titulo}
        </h1>
        {descricao ? (
          <p data-slot="cabecalho-descricao" className="text-base leading-6 text-tinta-2">
            {descricao}
          </p>
        ) : null}
      </div>
      {acao ? (
        <div data-slot="cabecalho-acao" className="shrink-0">
          {acao}
        </div>
      ) : null}
    </header>
  );
}
