import { cloneElement, type ReactElement } from 'react';

/**
 * Campo de formulário: rótulo, controle, dica e erro numa peça só.
 *
 * O `<label>` **é** o contêiner e o rótulo é implícito por aninhamento — sem
 * `htmlFor`, sem id gerado. Os e2e casam por `getByLabel('Seu nome')`, e o
 * aninhamento é o que mantém isso funcionando mesmo sem id nenhum.
 *
 * Também é aqui que mora a altura de 52px e os 16px de fonte que impedem o iOS
 * de dar zoom ao focar. Nada disso pode depender de cada tela lembrar.
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

export function Campo({ rotulo, dica, erro, prefixo, sufixo, children }: CampoProps) {
  const comInvolucro = Boolean(prefixo || sufixo);

  const propsDoControle = children.props as { className?: string; 'aria-invalid'?: unknown };
  const controle = cloneElement(children, {
    className: [propsDoControle.className, comInvolucro ? CONTROLE_DENTRO_DO_INVOLUCRO : '']
      .filter(Boolean)
      .join(' ') || undefined,
    'aria-invalid': propsDoControle['aria-invalid'] ?? (erro ? true : undefined),
  } as Partial<typeof propsDoControle>);

  return (
    <label className={`campo${erro ? ' campo--erro' : ''}`}>
      <span>{rotulo}</span>

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

      {dica ? <small>{dica}</small> : null}
      {erro ? (
        <span role="alert" className="text-perigo">
          {erro}
        </span>
      ) : null}
    </label>
  );
}
