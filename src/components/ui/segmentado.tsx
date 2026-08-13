'use client';

import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

/**
 * Dois ou três modos lado a lado — "Agora | Marcar hora" (§5.8).
 *
 * Existe porque o balcão tem dois trabalhos diferentes: o cara já está na
 * cadeira, ou alguém ligou. Forçar os dois pelo mesmo formulário é o que faz o
 * formulário de encaixe ter oito campos. A escolha vira um botão rotulado, e
 * não um checkbox perdido no meio de uma linha.
 *
 * Nunca mais de três opções: acima disso é lista, não segmentado.
 *
 * Por dentro compõe o `ToggleGroup` do shadcn, que traz o `role="group"`, o
 * `aria-pressed` de cada botão e a navegação por seta que a nossa versão de
 * botões soltos não tinha. **Desde 13/08/2026 a aparência também é a de lá**:
 * grupo em `flex` com largura de conteúdo, modo `outline` de 36px e o ativo
 * pintado em `aria-pressed:bg-muted`.
 *
 * Antes disso havia dois blocos de desfazimento (`DESFAZ_O_GRUPO` e
 * `DESFAZ_O_ITEM`) e um `style` embutido que reescreviam altura, raio, fundo,
 * borda e tipografia para o alvo de 52px e o ativo em tinta cheia da direção
 * antiga. Saíram inteiros: era a maior camada de desfazimento do produto.
 */
export type SegmentadoProps<T extends string> = {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  aoTrocar: (valor: T) => void;
  /** `aria-label` do grupo — sem ele os botões chegam soltos no leitor de tela. */
  rotuloDoGrupo: string;
};

/**
 * A única classe que sobra em cima da lib. O modo é um verbo curto, e o `min-w`
 * de 32px do `toggle` deixa "Agora" espremido contra a borda.
 */
export const segmentadoVariants = cva('px-3');

export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoTrocar,
  rotuloDoGrupo,
}: SegmentadoProps<T>) {
  return (
    <ToggleGroup
      aria-label={rotuloDoGrupo}
      variant="outline"
      size="lg"
      // O `ToggleGroup` do base-ui guarda um array mesmo quando só um item pode
      // ficar apertado. Tocar no modo já ativo devolve `[]` — e é por isso que
      // o balcão pode bater o dedo duas vezes no mesmo botão sem disparar nada.
      value={[valor]}
      onValueChange={(escolhidos) => {
        const novo = escolhidos[0] as T | undefined;
        if (novo && novo !== valor) aoTrocar(novo);
      }}
    >
      {opcoes.map((opcao) => (
        <ToggleGroupItem
          key={opcao.valor}
          value={opcao.valor}
          className={cn(segmentadoVariants())}
        >
          {opcao.rotulo}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
