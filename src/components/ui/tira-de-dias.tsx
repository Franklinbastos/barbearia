'use client';

/**
 * A tira de dias da página pública (§5.4).
 *
 * **Grade, nunca rolagem lateral.** A tira de hoje são 30 botões dentro de um
 * `overflow-x: auto`, marcados só por negrito: rolar de lado com uma mão, em
 * pé, é o gesto que mais se erra, e o dia escolhido não se distingue. Aqui são
 * 7 colunas × 2 linhas, tudo visível de uma vez, e o dia selecionado é um
 * retângulo cheio em `--marca`.
 */
export type DiaDaTira = {
  /** YYYY-MM-DD */
  iso: string;
  /** "HOJE" | "AMANHÃ" | "SEG" */
  rotulo: string;
  /** "08" */
  numero: string;
  /** Pinta o ponto de 4px. Vem de `GET …/availability/days`. */
  situacao: 'livre' | 'cheio' | 'desconhecido';
};

/**
 * A cor do ponto de 4px (§5.4): `--linha-suave` enquanto a resposta de
 * `/days` não chegou, `--tinta-3` no dia com vaga, nada no dia cheio — que já
 * se distingue pelo número em `--tinta-3`.
 *
 * Na ficha selecionada o fundo é `--marca`, então o ponto troca para
 * `--sobre-marca`; o "ainda não sei" some ali, porque um ponto cinza sobre a
 * marca não se lê e o dia aberto vai ter a grade logo abaixo respondendo.
 */
function corDoPonto(situacao: DiaDaTira['situacao'], marcado: boolean): string {
  if (situacao === 'cheio') return 'transparent';
  if (situacao === 'livre') return marcado ? 'var(--sobre-marca)' : 'var(--tinta-3)';
  return marcado ? 'transparent' : 'var(--linha-suave)';
}

export type TiraDeDiasProps = {
  /** 14 dias; a ficha "Outro dia" é desenhada por dentro. */
  dias: DiaDaTira[];
  selecionado: string;
  aoSelecionar: (iso: string) => void;
  /** Limite do `<input type="date">` de "Outro dia" — hoje + `maxAdvanceDays`. */
  maxIso: string;
};

/** "7 de set" — dia sem zero à esquerda, mês abreviado sem o ponto final. */
function limitePorExtenso(iso: string): string {
  const data = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'short' })
    .format(data)
    .replace(/\.$/, '');
}

export function TiraDeDias({ dias, selecionado, aoSelecionar, maxIso }: TiraDeDiasProps) {
  const foraDaTira = dias.every((d) => d.iso !== selecionado);
  const primeiro = dias[0]?.iso ?? selecionado;

  return (
    <div className="sticky top-[108px] z-10 -mx-4 grid grid-cols-7 gap-1 bg-bg px-4 pt-2 pb-3">
      {dias.map((d) => {
        const marcado = d.iso === selecionado;
        return (
          <button
            key={d.iso}
            type="button"
            aria-pressed={marcado}
            onClick={() => aoSelecionar(d.iso)}
            style={marcado ? { color: 'var(--sobre-marca)' } : undefined}
            className={[
              'flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-cx',
              marcado ? 'border-2 border-tinta bg-marca' : 'border border-linha bg-bg',
            ].join(' ')}
          >
            <span
              className={[
                'text-xs leading-4 font-bold uppercase',
                marcado ? '' : 'text-tinta-3',
              ].join(' ')}
            >
              {d.rotulo}
            </span>
            <span
              className={[
                'text-[22px] leading-[26px] font-extrabold',
                marcado ? '' : d.situacao === 'cheio' ? 'text-tinta-3' : 'text-tinta',
              ].join(' ')}
            >
              {d.numero}
            </span>
            {/* O dia cheio não pode ser só cor: quem usa leitor de tela não vê
                nem o ponto nem o número acinzentado. O `aria-disabled` continua
                fora de propósito — o cliente ainda pode abrir e ver por quê. */}
            {d.situacao === 'cheio' ? <span className="sr-only">sem vaga</span> : null}
            {/* O espaço de 4px fica reservado sempre, para nada saltar quando a
                resposta de `/days` chegar. */}
            <span
              aria-hidden="true"
              className="h-1 w-1 rounded-full"
              style={{ background: corDoPonto(d.situacao, marcado) }}
            />
          </button>
        );
      })}

      {/* "Outro dia": o `<input type="date">` nativo cobre a ficha inteira, e o
          `<label>` como contêiner dá a ele o nome acessível visível. Nada de
          retângulo tracejado mudo — a data-limite está escrita. */}
      <label
        style={foraDaTira ? { color: 'var(--sobre-marca)' } : undefined}
        className={[
          'relative col-span-7 mt-1 flex min-h-12 items-center justify-center rounded-cx',
          'text-sm leading-5 font-bold',
          foraDaTira
            ? 'border-2 border-tinta bg-marca'
            : 'border border-dashed border-linha text-tinta-2',
        ].join(' ')}
      >
        <span>Outro dia (até {limitePorExtenso(maxIso)})</span>
        <input
          type="date"
          value={foraDaTira ? selecionado : ''}
          min={primeiro}
          max={maxIso}
          onChange={(e) => {
            if (e.target.value) aoSelecionar(e.target.value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
