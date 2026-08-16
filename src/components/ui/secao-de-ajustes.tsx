import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

/**
 * Uma seção da tela de configurações: título e descrição acima, card de campos
 * abaixo.
 *
 * Resolve o alinhamento quebrado medido em 16/08 — "Nome da barbearia"
 * começava em x=588 e "Endereço público", no mesmo card, em x=424. Era uma
 * seção anotada pela metade: metade do conteúdo respeitava uma coluna de rótulo
 * que a outra metade ignorava. Com o rótulo da seção fora do card, sobra um
 * alinhamento só.
 *
 * **Empilhado, e não o `2fr 5fr` do Polaris lado a lado.** O lado a lado só
 * respira a partir de 1120px, e subir esta tela de `tabela` (880) para
 * `leitura` (1120) a tiraria da coluna das outras cinco do painel — o defeito
 * que a rodada de 15/08 corrigiu. Sete campos não pagam essa quebra (§2.2 da
 * spec de 16/08).
 *
 * **Sem `'use client'`, de propósito**, como no `CabecalhoDePagina`: quem monta
 * as seções é um Server Component e aqui não há estado nenhum. É também por
 * isso que a `<section>` não vira landmark nomeada — o `aria-labelledby` pediria
 * um id gerado, e `useId` é hook. Quem navega por cabeçalho acha o `<h2>` do
 * mesmo jeito.
 */
export const secaoDeAjustesVariants = cva('flex flex-col gap-3');

export type SecaoDeAjustesProps = React.ComponentProps<'section'> & {
  titulo: string;
  /** 1–3 frases. Omita quando o título já basta — o Polaris manda não escrever descrição inútil. */
  descricao?: string;
};

export function SecaoDeAjustes({
  titulo,
  descricao,
  children,
  className,
  ...props
}: SecaoDeAjustesProps) {
  return (
    <section
      data-slot="secao-de-ajustes"
      className={cn(secaoDeAjustesVariants(), className)}
      {...props}
    >
      {/* Título e descrição andam colados em 4px, como no `CabecalhoDePagina`:
          a descrição explica o título, e no mesmo espaçamento do card os dois
          viravam duas coisas soltas boiando acima dele.

          Quem empilhar as seções precisa de mais ar entre elas do que os 12px
          daqui — senão o olho junta o card de uma com o título da seguinte. */}
      <div data-slot="secao-anotacao" className="flex flex-col gap-1">
        {/* `<h2>`: a página já tem o `<h1>` no `CabecalhoDePagina`.
            16/24/700, e não o 16/500 do `CardTitle` que ele substitui — fora do
            card este título governa micro-rótulos de 14/20/700, e cabeçalho
            mais leve do que o rótulo que ele manda inverte a hierarquia. */}
        <h2 data-slot="secao-titulo" className="text-base leading-6 font-bold">
          {titulo}
        </h2>

        {descricao ? (
          <p data-slot="secao-descricao" className="text-sm leading-5 text-muted-foreground">
            {descricao}
          </p>
        ) : null}
      </div>

      {/* Coluna de 16px por padrão, que é o que campo empilhado quer. Quem
          precisar de outro arranjo — as regras da agenda vão em duas colunas —
          passa um filho só, com a grade dele. */}
      <Card>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
      </Card>
    </section>
  );
}
