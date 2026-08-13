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
 * botões soltos não tinha. A **aparência continua nossa** e continua vindo do
 * `style` embutido: propriedade em linha é a única coisa que vence a camada de
 * utilitários sem depender de ordem de arquivo, e o base-nova pinta fundo em
 * `aria-pressed:bg-muted` — cinza onde o nosso ativo é tinta cheia.
 */
export type SegmentadoProps<T extends string> = {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  aoTrocar: (valor: T) => void;
  /** `aria-label` do grupo — sem ele os botões chegam soltos no leitor de tela. */
  rotuloDoGrupo: string;
};

/**
 * O texto-base do `toggle-group` do base-nova decide aparência em cinco pontos,
 * e cada linha aqui desfaz exatamente um. Sem isto o segmentado vira uma tira
 * de 32px encostada à esquerda: os dois modos deixariam de dividir a largura em
 * partes iguais (`flex w-fit`), parariam de esticar até a mesma altura
 * (`items-center`), "Marcar hora" não quebraria mais linha em 360px
 * (`whitespace-nowrap`), a fonte cairia para 14px sem negrito e o anel de foco
 * da §3.1 daria lugar a um anel de 3px próprio.
 */
const DESFAZ_O_GRUPO = [
  'grid', //           desfaz `flex`: as colunas de 1fr dividem a largura em partes iguais
  'w-auto', //         desfaz `w-fit`
  'items-stretch', //  desfaz `items-center`: os modos têm a mesma altura mesmo com uma quebra
  'gap-2', //          repõe os 8px sem depender do `--gap` que o `style` de fora substitui
  'rounded-none', //   desfaz `rounded-lg`: o raio é de cada modo, o grupo não desenha nada
].join(' ');

const DESFAZ_O_ITEM = [
  'flex', //              desfaz `inline-flex`, para o item ocupar a célula inteira
  'h-auto', //            desfaz `h-8`: a altura é do `style`, e é 52px
  'min-w-0', //           desfaz `min-w-8`
  'whitespace-normal', // desfaz `whitespace-nowrap`: rótulo longo quebra em 360px
  'text-[16px] leading-6 font-bold', // desfaz `text-sm font-medium`
  // devolve o `--anel` da §3.1 no lugar do anel próprio do base-nova, como em
  // `botao.tsx`: o `ring-3` continua declarado, só que transparente.
  'focus-visible:ring-transparent focus-visible:shadow-[var(--anel)]',
].join(' ');

export const segmentadoVariants = cva(cn('px-3', DESFAZ_O_ITEM));

export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoTrocar,
  rotuloDoGrupo,
}: SegmentadoProps<T>) {
  return (
    <ToggleGroup
      aria-label={rotuloDoGrupo}
      // O `ToggleGroup` do base-ui guarda um array mesmo quando só um item pode
      // ficar apertado. Tocar no modo já ativo devolve `[]` — e é por isso que
      // o balcão pode bater o dedo duas vezes no mesmo botão sem disparar nada.
      value={[valor]}
      onValueChange={(escolhidos) => {
        const novo = escolhidos[0] as T | undefined;
        if (novo && novo !== valor) aoTrocar(novo);
      }}
      className={cn(DESFAZ_O_GRUPO)}
      style={{ gridTemplateColumns: `repeat(${opcoes.length}, 1fr)` }}
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <ToggleGroupItem
            key={opcao.valor}
            value={opcao.valor}
            // `variant`/`size` em `null` desligam a paleta e a métrica do
            // base-nova de propósito: `default` lá é 32px de altura com 10px de
            // recheio, e o nosso modo é alvo de balcão de 52px.
            variant={null}
            size={null}
            className={cn(segmentadoVariants())}
            style={{
              // Altura é propriedade do controle, nunca classe que alguém cola.
              minHeight: 'var(--tap-md)',
              borderRadius: 'var(--r)',
              background: ativo ? 'var(--tinta)' : 'transparent',
              color: ativo ? 'var(--acao-tinta)' : 'var(--tinta)',
              border: ativo ? '2px solid var(--tinta)' : '1px solid var(--linha)',
              transition: 'background-color 120ms linear',
            }}
          >
            {opcao.rotulo}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
