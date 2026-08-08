'use client';

/**
 * Substitui o `<select>` onde a troca é frequente (§5.8).
 *
 * Com o dedo com talco e o cliente na cadeira, a roleta nativa do sistema custa
 * dois toques precisos: abrir e acertar a linha. A ficha custa um toque grande.
 *
 * `nomeDoCampoOculto` renderiza um `<input type="hidden">` com o valor — assim
 * a server action que já existe continua lendo o mesmo campo do `FormData` e
 * não muda uma linha.
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
      <div
        role="group"
        aria-label={rotuloDoGrupo}
        className="flex flex-wrap gap-2"
        style={rola ? { maxHeight: alturaMaxima, overflowY: 'auto' } : undefined}
      >
        {opcoes.map((opcao) => {
          const ativa = opcao.valor === valor;
          return (
            <button
              key={opcao.valor || 'qualquer'}
              type="button"
              aria-pressed={ativa}
              onClick={() => (ativa ? undefined : aoTrocar(opcao.valor))}
              className="flex flex-auto items-center justify-center gap-2 px-3 text-[15px] leading-5"
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
              {opcao.detalhe ? (
                <span className="shrink-0 text-tinta-2">{opcao.detalhe}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {nomeDoCampoOculto ? (
        <input type="hidden" name={nomeDoCampoOculto} value={valor} />
      ) : null}
    </>
  );
}
