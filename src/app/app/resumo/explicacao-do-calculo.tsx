import { Info } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * O "de onde veio este número", atrás do ícone de informação — o princípio nº 3
 * do spec e o item 4 da §5.12 da direção de UI.
 *
 * **É `Popover`, e não `Tooltip`, porque a explicação precisa abrir no dedo.**
 * O card vive num celular na mão do dono, e o `Tooltip` do base-ui não abre no
 * toque: a documentação do próprio pacote diz que "tooltips are disabled on
 * touch devices" (`docs/react/components/tooltip.md`) — não há gesto padrão de
 * hover no celular e o toque longo conflita com o menu do navegador. A mesma
 * página manda usar `Popover` com `openOnHover` justamente para o ícone de
 * informação, "so touch users and screen reader users can access the content".
 * Era o caso aqui: a explicação existia no código e era inalcançável na tela em
 * que o produto é usado.
 *
 * `openOnHover` preserva o comportamento de desktop — passar o mouse basta, sem
 * clicar —, e o clique e o `Enter` passam a funcionar em cima disso. O
 * `delay` de 150ms é o mesmo de antes: sem ele, atravessar a fileira de cards
 * com o mouse abre e fecha quatro balões.
 *
 * **O texto vive fora do card no acessível**: o popup é um `dialog` anunciado
 * ao abrir, em vez do `aria-describedby` que o tooltip pendurava no botão.
 */
export type ExplicacaoDoCalculoProps = {
  /** O indicador explicado — vira "Como ocupação é calculado" no rótulo do alvo. */
  de: string;
  /** Como o número é calculado, em uma frase. */
  texto: string;
};

export function ExplicacaoDoCalculo({ de, texto }: ExplicacaoDoCalculoProps) {
  return (
    <Popover>
      <PopoverTrigger
        data-slot="cartao-indicador-explicacao"
        openOnHover
        delay={150}
        // O alvo é pequeno de propósito — é ajuda, não ação —, mas o `p-1` mais
        // o ícone de 16px dão os 24px que o dedo alcança sem brigar com o
        // número ao lado.
        className="-m-1 cursor-help rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Info aria-hidden="true" className="size-4" />
        <span className="sr-only">Como {de.toLowerCase()} é calculado</span>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="text-sm leading-5">
        {texto}
      </PopoverContent>
    </Popover>
  );
}
