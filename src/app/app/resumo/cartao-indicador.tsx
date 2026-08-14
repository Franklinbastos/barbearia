import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import { Info } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * O card de número do resumo — o tijolo da tela inteira (§2.1 e §2.3 do spec).
 *
 * **Número, não gráfico.** O dono decide com "68% de ocupação na terça", não
 * com uma barra bonita. Por isso o valor é o maior tipo da escala (34px) e tudo
 * o mais no card existe para qualificá-lo: título em cima, apoio embaixo,
 * comparação ao lado.
 *
 * **A explicação do cálculo não é enfeite, é o princípio nº 3 do spec.** Cada
 * indicador diz de onde veio, em uma linha, ao ser tocado. É o que o Phorest
 * acertou e o que separa métrica confiável de número mágico: o dono que não
 * sabe o que entra no denominador não usa o número para decidir nada — e em
 * comissão, onde o barbeiro vai conferir, é a diferença entre relatório e
 * discussão. Fica num `Tooltip` do `base-ui`, que abre no toque
 * (`triggerPress`), no hover e no foco de teclado; o botão é o alvo, e o texto
 * chega ao leitor de tela pelo `aria-describedby` que o próprio componente liga.
 *
 * **`tabular-nums` no valor** porque o número troca a cada navegação de
 * período. Sem largura fixa de dígito ele dança de posição, e coluna que dança
 * é erro de instrumento (§3.2 da direção de UI).
 *
 * **A comparação nunca depende só de cor.** Verde e vermelho carregam o
 * sentido para quem enxerga a diferença; para quem não enxerga há uma palavra
 * escondida ("melhor que" / "pior que") logo antes do texto. E quem decide o
 * que é "melhor" é quem chama: taxa de falta que cai melhorou, faturamento que
 * cai piorou, e o card não tem como saber sozinho.
 */
export type ComparacaoDoIndicador = {
  /** O texto pronto: "+18% que a semana passada". */
  valor: string;
  /** Se o movimento é bom para a barbearia. Quem chama decide o sentido. */
  melhorou: boolean;
};

export type CartaoIndicadorProps = Omit<ComponentProps<'div'>, 'title' | 'children'> & {
  titulo: string;
  /** Já formatado — "R$ 4.500,00", "68%". O card não sabe formatar nada. */
  valor: string;
  /** A linha de baixo: horas vagas, receita perdida, quantidade de atendimentos. */
  apoio?: string;
  comparacao?: ComparacaoDoIndicador;
  /** Como o número é calculado, em uma frase. Obrigatório de propósito. */
  explicacao: string;
};

export const cartaoIndicadorVariants = cva('gap-3');

/** Micro-rótulo da §3.2: 12/16/700, caixa alta, tracking largo. */
export const tituloDoIndicadorVariants = cva(
  'text-xs leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase',
);

export const valorDoIndicadorVariants = cva('text-[34px] leading-10 font-bold tabular-nums');

export function CartaoIndicador({
  titulo,
  valor,
  apoio,
  comparacao,
  explicacao,
  className,
  ...resto
}: CartaoIndicadorProps) {
  return (
    <Card data-slot="cartao-indicador" className={cn(cartaoIndicadorVariants(), className)} {...resto}>
      <CardHeader className="grid-cols-[1fr_auto] items-center gap-2">
        <CardTitle data-slot="cartao-indicador-titulo" className={tituloDoIndicadorVariants()}>
          {titulo}
        </CardTitle>

        <Tooltip>
          <TooltipTrigger
            data-slot="cartao-indicador-explicacao"
            delay={150}
            // O alvo é pequeno de propósito — é ajuda, não ação —, mas o
            // `p-1` mais o ícone de 16px dão os 24px que o dedo alcança sem
            // brigar com o número ao lado.
            className="-m-1 cursor-help rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Info aria-hidden="true" className="size-4" />
            <span className="sr-only">Como {titulo.toLowerCase()} é calculado</span>
          </TooltipTrigger>
          <TooltipContent side="top" align="end">
            {explicacao}
          </TooltipContent>
        </Tooltip>
      </CardHeader>

      <CardContent className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p data-slot="cartao-indicador-valor" className={valorDoIndicadorVariants()}>
            {valor}
          </p>

          {comparacao ? (
            <Badge
              data-slot="cartao-indicador-comparacao"
              variant="outline"
              className={cn(
                'tabular-nums',
                comparacao.melhorou
                  ? 'border-transparent bg-ok-bg text-ok'
                  : 'border-transparent bg-perigo-bg text-perigo',
              )}
            >
              <span className="sr-only">{comparacao.melhorou ? 'melhor que' : 'pior que'} </span>
              {comparacao.valor}
            </Badge>
          ) : null}
        </div>

        {apoio ? (
          <p data-slot="cartao-indicador-apoio" className="text-sm leading-5 text-muted-foreground">
            {apoio}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
