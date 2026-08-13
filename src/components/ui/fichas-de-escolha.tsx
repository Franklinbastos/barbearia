'use client';

import { Radio } from '@base-ui/react/radio';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { RadioGroup } from './radio-group';

/**
 * Substitui o `<select>` onde a troca é frequente (§5.8).
 *
 * Com o dedo com talco e o cliente na cadeira, a roleta nativa do sistema custa
 * dois toques precisos: abrir e acertar a linha. A ficha custa um toque grande.
 *
 * `nomeDoCampoOculto` renderiza um `<input type="hidden">` com o valor — assim
 * a server action que já existe continua lendo o mesmo campo do `FormData` e
 * não muda uma linha. O `RadioGroup` fica **sem `name`** de propósito: com
 * `name` o base-ui passa a emitir os próprios `<input type="radio">` nomeados e
 * o `FormData` do encaixe chegaria com o campo duas vezes.
 *
 * Por dentro compõe o `RadioGroup` do shadcn, que traz o `role="radiogroup"`, a
 * navegação por seta e o único ponto de tabulação que um grupo de escolha deve
 * ter. Antes eram N botões `aria-pressed`, que o leitor de tela anunciava como
 * N botões independentes.
 *
 * **Desde 13/08/2026 a aparência é a da lib**: a ficha passou a ser o `toggle`
 * `outline` do base-nova (36px, raio de 10px, borda em `--input`, 14px, ativo em
 * `bg-muted` com borda em `--primary`). Antes disso a forma vinha toda de um
 * `style` embutido — 48px de alvo, borda de 2px em tinta e peso 700 no ativo.
 */
export type FichaDeEscolha = {
  valor: string;
  rotulo: string;
  detalhe?: string;
  /** String CSS pronta — o quadrado de 8px da cor do barbeiro (§3.5). */
  cor?: string;
};

export type FichasDeEscolhaProps = {
  rotuloDoGrupo: string;
  opcoes: FichaDeEscolha[];
  valor: string;
  aoTrocar: (valor: string) => void;
  nomeDoCampoOculto?: string;
  /** Acima de seis opções a lista rola por dentro em vez de empurrar a folha. */
  alturaMaxima?: number;
};

/** Passando disto, a lista de fichas rola por dentro. */
const OPCOES_ANTES_DE_ROLAR = 6;

/**
 * O `RadioGroup` do base-nova empilha as opções numa coluna que ocupa a largura
 * toda, porque lá o item é uma bolinha com rótulo ao lado. A ficha é o
 * contrário: quadradinho que se acomoda lado a lado e quebra linha quando não
 * cabe. Isto não é desfazimento de aparência — é a forma do componente, e
 * sobreviveu à adoção da cara nativa em 13/08/2026.
 */
const FICHAS_LADO_A_LADO = 'flex w-auto flex-wrap';

/**
 * O `RadioGroupItem` do base-nova não serve aqui e não dá para adaptar: ele é
 * uma bolinha de 16px que **renderiza o próprio indicador como filho** e ignora
 * o `children` que a gente passar. Ficha é cartão com rótulo, cor e detalhe
 * dentro. Por isso o item vem do primitivo `Radio.Root` direto, que chega sem
 * classe nenhuma — e a ficha copia à mão o `toggle` `outline` da lib, que é o
 * componente mais próximo que ela tem.
 *
 * `cursor-pointer` e `text-center` repõem dois padrões que a ficha ganhava de
 * graça enquanto era `<button>`: o dedo do balcão e o rótulo centrado quando ele
 * é curto demais para encher a ficha. `Radio.Root` é um `<span>`.
 */
export const fichaVariants = cva(
  cn(
    'flex min-h-[var(--altura-controle)] min-w-24 flex-auto cursor-pointer items-center justify-center gap-2',
    'rounded-lg border border-input px-2.5 text-center text-sm leading-5 transition-all outline-none',
    'hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    'data-checked:border-primary data-checked:bg-muted data-checked:font-medium',
  ),
);

export function FichasDeEscolha({
  rotuloDoGrupo,
  opcoes,
  valor,
  aoTrocar,
  nomeDoCampoOculto,
  alturaMaxima = 160,
}: FichasDeEscolhaProps) {
  const rola = opcoes.length > OPCOES_ANTES_DE_ROLAR;

  return (
    <>
      <RadioGroup
        aria-label={rotuloDoGrupo}
        value={valor}
        onValueChange={(novo) => {
          const escolhido = String(novo ?? '');
          // Tocar na ficha que já está ativa não dispara nada: o balcão bate o
          // dedo duas vezes na mesma ficha o tempo todo.
          if (escolhido !== valor) aoTrocar(escolhido);
        }}
        className={cn(FICHAS_LADO_A_LADO, 'gap-2')}
        style={rola ? { maxHeight: alturaMaxima, overflowY: 'auto' } : undefined}
      >
        {opcoes.map((opcao) => (
          <Radio.Root
            key={opcao.valor || 'qualquer'}
            value={opcao.valor}
            className={cn(fichaVariants())}
          >
            {opcao.cor ? (
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 shrink-0"
                style={{ background: opcao.cor }}
              />
            ) : null}
            <span className="truncate">{opcao.rotulo}</span>
            {opcao.detalhe ? (
              <span className="shrink-0 text-muted-foreground">{opcao.detalhe}</span>
            ) : null}
          </Radio.Root>
        ))}
      </RadioGroup>

      {nomeDoCampoOculto ? <input type="hidden" name={nomeDoCampoOculto} value={valor} /> : null}
    </>
  );
}
