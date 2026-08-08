'use client';

/**
 * Dois ou três modos lado a lado — "Agora | Marcar hora" (§5.8).
 *
 * Existe porque o balcão tem dois trabalhos diferentes: o cara já está na
 * cadeira, ou alguém ligou. Forçar os dois pelo mesmo formulário é o que faz o
 * formulário de encaixe ter oito campos. A escolha vira um botão rotulado, e
 * não um checkbox perdido no meio de uma linha.
 *
 * Nunca mais de três opções: acima disso é lista, não segmentado.
 */
export type SegmentadoProps<T extends string> = {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  aoTrocar: (valor: T) => void;
  /** `aria-label` do grupo — sem ele os botões chegam soltos no leitor de tela. */
  rotuloDoGrupo: string;
};

export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoTrocar,
  rotuloDoGrupo,
}: SegmentadoProps<T>) {
  return (
    <div
      role="group"
      aria-label={rotuloDoGrupo}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${opcoes.length}, 1fr)` }}
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={ativo}
            // Tocar no modo que já está ativo não dispara nada: o balcão bate o
            // dedo duas vezes no mesmo botão o tempo todo.
            onClick={() => (ativo ? undefined : aoTrocar(opcao.valor))}
            className="flex items-center justify-center px-3 text-[16px] leading-6 font-bold"
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
          </button>
        );
      })}
    </div>
  );
}
