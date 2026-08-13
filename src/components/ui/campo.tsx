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
 * direto dele: é o seletor `.campo > input` que dá altura, borda e raio. Desde
 * 13/08/2026 essa regra **copia** o `input` do base-nova (h-9, px-2.5,
 * rounded-lg, borda em `--input`) em vez de desfazê-lo — o contorno é da lib
 * porque o controle chega aqui como `children` cru e não passa pelo `Input`.
 *
 * A única exceção da migração mora nessa regra: **16px de fonte no celular**,
 * porque abaixo disso o Safari do iOS dá zoom ao focar. O corte em 768px é o
 * mesmo que o `Input` da lib faz (`text-base md:text-sm`), então a página
 * pública fica nos 16px e o painel no desktop desce para os 14px.
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
  'min-h-[var(--altura-controle)] w-full flex-1 border-0 bg-transparent px-2.5 text-base leading-5 outline-none md:text-sm';

const AFIXO =
  'flex min-h-[var(--altura-controle)] shrink-0 items-center justify-center bg-muted px-2.5 text-base leading-5 text-muted-foreground md:text-sm';

/**
 * O `.campo > input` já carrega esta altura. O utilitário existe para ela ficar
 * no elemento, e não só numa regra de folha de estilo que um dia alguém move.
 */
const ALTURA_DE_CONTROLE = 'min-h-[var(--altura-controle)]';

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
        ALTURA_DE_CONTROLE,
        comInvolucro ? CONTROLE_DENTRO_DO_INVOLUCRO : '',
      ) || undefined,
    'aria-invalid': propsDoControle['aria-invalid'] ?? (erro ? true : undefined),
    'aria-describedby': descritores,
  } as Partial<typeof propsDoControle>);

  return (
    <Field className={cn('campo', erro ? 'campo--erro' : undefined)}>
      <FieldLabel htmlFor={idDoControle}>{rotulo}</FieldLabel>

      {comInvolucro ? (
        <div
          className={`flex items-stretch overflow-hidden rounded-lg bg-transparent ${
            erro ? 'border border-destructive' : 'border border-input'
          }`}
        >
          {prefixo ? (
            <span aria-hidden="true" className={`${AFIXO} min-w-10 border-r border-input`}>
              {prefixo}
            </span>
          ) : null}
          {controle}
          {sufixo ? (
            <span aria-hidden="true" className={`${AFIXO} border-l border-input`}>
              {sufixo}
            </span>
          ) : null}
        </div>
      ) : (
        controle
      )}

      {dica ? <FieldDescription id={idDaDica}>{dica}</FieldDescription> : null}

      {erro ? <FieldError id={idDoErro}>{erro}</FieldError> : null}
    </Field>
  );
}
