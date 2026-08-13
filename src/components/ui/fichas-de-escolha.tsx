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
 * toda. A ficha é o contrário: quadradinho que se acomoda lado a lado e quebra
 * linha quando não cabe.
 */
const DESFAZ_O_GRUPO = [
  'flex flex-wrap', // desfaz `grid`: as fichas se acomodam lado a lado
  'w-auto', //         desfaz `w-full`
].join(' ');

/**
 * O `RadioGroupItem` do base-nova não serve aqui e não dá para adaptar: ele é
 * uma bolinha de 16px que **renderiza o próprio indicador como filho** e ignora
 * o `children` que a gente passar. Ficha é cartão com rótulo, cor e detalhe
 * dentro. Por isso o item vem do primitivo `Radio.Root` direto, que chega sem
 * classe nenhuma — não há aparência do base-nova para desfazer aqui.
 */
export const fichaVariants = cva(
  // `cursor-pointer` e `text-center` repõem dois padrões que a ficha ganhava de
  // graça enquanto era `<button>`: o dedo do balcão e o rótulo centrado quando
  // ele é curto demais para encher a ficha. `Radio.Root` é um `<span>`.
  'flex flex-auto cursor-pointer items-center justify-center gap-2 px-3 text-center text-[15px] leading-5',
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
        className={cn(DESFAZ_O_GRUPO, 'gap-2')}
        style={rola ? { maxHeight: alturaMaxima, overflowY: 'auto' } : undefined}
      >
        {opcoes.map((opcao) => {
          const ativa = opcao.valor === valor;
          return (
            <Radio.Root
              key={opcao.valor || 'qualquer'}
              value={opcao.valor}
              className={cn(fichaVariants())}
              style={{
                minHeight: 'var(--tap)',
                minWidth: 96,
                borderRadius: 'var(--r)',
                background: ativa ? 'var(--superficie-2)' : 'transparent',
                border: ativa ? '2px solid var(--tinta)' : '1px solid var(--linha)',
                color: 'var(--tinta)',
                fontWeight: ativa ? 700 : 400,
              }}
            >
              {opcao.cor ? (
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 shrink-0"
                  style={{ background: opcao.cor }}
                />
              ) : null}
              <span className="truncate">{opcao.rotulo}</span>
              {opcao.detalhe ? <span className="shrink-0 text-tinta-2">{opcao.detalhe}</span> : null}
            </Radio.Root>
          );
        })}
      </RadioGroup>

      {nomeDoCampoOculto ? <input type="hidden" name={nomeDoCampoOculto} value={valor} /> : null}
    </>
  );
}
