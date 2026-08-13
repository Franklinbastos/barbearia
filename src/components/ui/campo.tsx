import { cloneElement, useId, type ReactElement } from 'react';

import { cn } from '@/lib/utils';
import { Field, FieldDescription, FieldError, FieldLabel } from './field';

/**
 * Campo de formulário: rótulo, controle, dica e erro numa peça só.
 *
 * Por dentro usa a anatomia do `field` do shadcn — `Field`, `FieldLabel`,
 * `FieldDescription`, `FieldError` — com o id gerado por `useId()` e ligado por
 * `htmlFor`. O rótulo deixou de ser implícito por aninhamento, e isso é um
 * ganho: com o `<label>` envolvendo tudo, a mensagem de erro entrava no texto
 * do rótulo e `getByLabel('Telefone')` parava de achar o campo justamente
 * quando havia erro na tela.
 *
 * O contêiner continua com a classe `.campo`, e o controle continua sendo filho
 * direto dele: é o seletor `.campo > input` da §3.1 que dá altura de 52px,
 * borda, raio e os 16px de fonte que impedem o iOS de dar zoom ao focar. A
 * aparência não mudou de dono — só a caixa em volta.
 *
 * **Sem `'use client'`, de propósito.** O `useId()` roda em Server Component no
 * React 19, e `/app/clientes` renderiza `<Campo>` do servidor. Marcado como
 * cliente, o `children` atravessaria a fronteira como referência preguiçosa,
 * `children.props` viria `undefined` e o `cloneElement` abaixo quebraria a
 * página inteira em tempo de hidratação — sem erro no build nem no servidor.
 */
export type CampoProps = {
  /** Texto literal — há e2e casando por ele. */
  rotulo: string;
  dica?: string;
  /** Renderiza a mensagem abaixo e liga a borda de erro. */
  erro?: string | null;
  /** "R$" como elemento real, nunca placeholder. */
  prefixo?: string;
  /** "min" */
  sufixo?: string;
  /** O `<input>`/`<select>`/`<textarea>` cru. */
  children: ReactElement;
};

/**
 * Com prefixo ou sufixo o controle deixa de ser filho direto de `.campo`, e o
 * seletor `.campo > input` da §3.1 para de alcançá-lo. Aqui a moldura passa a
 * ser do invólucro e o controle fica sem borda por dentro dela.
 */
const CONTROLE_DENTRO_DO_INVOLUCRO =
  'min-h-[var(--tap-md)] w-full flex-1 border-0 bg-transparent px-3 text-base leading-6 outline-none';

const AFIXO =
  'flex min-h-[var(--tap-md)] shrink-0 items-center justify-center bg-superficie-2 px-3 text-base leading-6 text-tinta-2';

/**
 * O `.campo > input` já carrega esta altura. O utilitário existe para ela ficar
 * no elemento, e não só numa regra de folha de estilo que um dia alguém move.
 */
const ALTURA_DE_BALCAO = 'min-h-[var(--tap-md)]';

/**
 * A §3.1 decidiu 14px/20px, peso 700 e `--tinta-2` para o rótulo, `--tinta-3`
 * para a dica e peso 700 para o erro. O `field`, o `label` e o `input` do
 * base-nova trazem outra tipografia (entrelinha zerada, peso 500, cinza de
 * texto secundário e um recuo negativo na descrição quando ela é a penúltima
 * filha). Cada classe abaixo desfaz exatamente uma dessas decisões.
 */
const ROTULO = 'leading-5 font-bold text-tinta-2';
const DICA = 'leading-5 text-tinta-3 nth-last-2:mt-0';
const ERRO = 'font-bold';

export function Campo({ rotulo, dica, erro, prefixo, sufixo, children }: CampoProps) {
  const semente = useId();
  const comInvolucro = Boolean(prefixo || sufixo);

  const propsDoControle = children.props as {
    id?: string;
    className?: string;
    'aria-invalid'?: unknown;
    'aria-describedby'?: string;
  };

  const idDoControle = propsDoControle.id ?? `${semente}controle`;
  const idDaDica = dica ? `${semente}dica` : undefined;
  const idDoErro = erro ? `${semente}erro` : undefined;

  const descritores =
    [propsDoControle['aria-describedby'], idDaDica, idDoErro].filter(Boolean).join(' ') || undefined;

  const controle = cloneElement(children, {
    id: idDoControle,
    className:
      cn(
        propsDoControle.className,
        ALTURA_DE_BALCAO,
        comInvolucro ? CONTROLE_DENTRO_DO_INVOLUCRO : '',
      ) || undefined,
    'aria-invalid': propsDoControle['aria-invalid'] ?? (erro ? true : undefined),
    'aria-describedby': descritores,
  } as Partial<typeof propsDoControle>);

  return (
    <Field className={cn('campo gap-1.5', erro ? 'campo--erro' : undefined)}>
      <FieldLabel htmlFor={idDoControle} className={ROTULO}>
        {rotulo}
      </FieldLabel>

      {comInvolucro ? (
        <div
          className={`flex items-stretch overflow-hidden rounded-cx bg-bg ${
            erro ? 'border-2 border-perigo' : 'border border-linha'
          }`}
        >
          {prefixo ? (
            <span aria-hidden="true" className={`${AFIXO} min-w-12 border-r border-linha`}>
              {prefixo}
            </span>
          ) : null}
          {controle}
          {sufixo ? (
            <span aria-hidden="true" className={`${AFIXO} border-l border-linha`}>
              {sufixo}
            </span>
          ) : null}
        </div>
      ) : (
        controle
      )}

      {dica ? (
        <FieldDescription id={idDaDica} className={DICA}>
          {dica}
        </FieldDescription>
      ) : null}

      {erro ? (
        <FieldError id={idDoErro} className={ERRO}>
          {erro}
        </FieldError>
      ) : null}
    </Field>
  );
}
