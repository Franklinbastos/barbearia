'use client';

import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * A tira de dias da página pública (§5.4).
 *
 * **Grade, nunca rolagem lateral.** A tira de hoje são 30 botões dentro de um
 * `overflow-x: auto`, marcados só por negrito: rolar de lado com uma mão, em
 * pé, é o gesto que mais se erra, e o dia escolhido não se distingue. Aqui são
 * 7 colunas × 2 linhas, tudo visível de uma vez, e o dia selecionado é um
 * retângulo cheio em `--marca`.
 *
 * **Por que não veio do shadcn.** O registry não tem nada parecido: `calendar`
 * é um mês inteiro com navegação, e a §5.4 é o oposto disso — catorze fichas de
 * 60px numa grade fixa. A anatomia é que segue o padrão da casa: `cva` para as
 * variantes, `cn` para compor com a `className` de fora e `data-slot` em cada
 * parte estilizável.
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

export type TiraDeDiasProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** 14 dias; a ficha "Outro dia" é desenhada por dentro. */
  dias: DiaDaTira[];
  selecionado: string;
  aoSelecionar: (iso: string) => void;
  /** Limite do `<input type="date">` de "Outro dia" — hoje + `maxAdvanceDays`. */
  maxIso: string;
};

/**
 * Sem variante: a tira é uma só. O `cva` fica assim mesmo por ser o gancho de
 * composição que o resto de `src/components/ui` exporta — quem precisar da
 * grade sem a colagem (`sticky`) compõe por cima em vez de recopiar a lista.
 */
export const tiraDeDiasVariants = cva(
  'sticky top-[108px] z-10 -mx-4 grid grid-cols-7 gap-1 bg-bg px-4 pt-2 pb-3',
);

export const fichaDaTiraVariants = cva(
  'flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-cx',
  {
    variants: {
      marcado: {
        true: 'border-2 border-tinta bg-marca text-[var(--sobre-marca)]',
        false: 'border border-linha bg-bg',
      },
    },
    defaultVariants: { marcado: false },
  },
);

/**
 * A cor do ponto de 4px (§5.4): `--linha-suave` enquanto a resposta de
 * `/days` não chegou, `--tinta-3` no dia com vaga, nada no dia cheio — que já
 * se distingue pelo número em `--tinta-3`.
 *
 * Na ficha selecionada o fundo é `--marca`, então o ponto troca para
 * `--sobre-marca`; o "ainda não sei" some ali, porque um ponto cinza sobre a
 * marca não se lê e o dia aberto vai ter a grade logo abaixo respondendo.
 */
export const pontoDaTiraVariants = cva('h-1 w-1 rounded-full', {
  variants: {
    situacao: {
      livre: 'bg-tinta-3',
      cheio: 'bg-transparent',
      desconhecido: 'bg-linha-suave',
    },
    marcado: { true: '', false: '' },
  },
  compoundVariants: [
    { situacao: 'livre', marcado: true, class: 'bg-[var(--sobre-marca)]' },
    { situacao: 'desconhecido', marcado: true, class: 'bg-transparent' },
  ],
  defaultVariants: { situacao: 'desconhecido', marcado: false },
});

export const outroDiaVariants = cva(
  [
    'relative col-span-7 mt-1 flex min-h-12 items-center justify-center rounded-cx',
    'text-sm leading-5 font-bold',
  ],
  {
    variants: {
      marcado: {
        true: 'border-2 border-tinta bg-marca text-[var(--sobre-marca)]',
        false: 'border border-dashed border-linha text-tinta-2',
      },
    },
    defaultVariants: { marcado: false },
  },
);

/** "7 de set" — dia sem zero à esquerda, mês abreviado sem o ponto final. */
function limitePorExtenso(iso: string): string {
  const data = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'short' })
    .format(data)
    .replace(/\.$/, '');
}

export function TiraDeDias({
  dias,
  selecionado,
  aoSelecionar,
  maxIso,
  className,
  ...resto
}: TiraDeDiasProps) {
  const foraDaTira = dias.every((d) => d.iso !== selecionado);
  const primeiro = dias[0]?.iso ?? selecionado;

  return (
    <div data-slot="tira-de-dias" className={cn(tiraDeDiasVariants(), className)} {...resto}>
      {dias.map((d) => {
        const marcado = d.iso === selecionado;
        return (
          <button
            key={d.iso}
            type="button"
            data-slot="tira-dia"
            aria-pressed={marcado}
            onClick={() => aoSelecionar(d.iso)}
            className={cn(fichaDaTiraVariants({ marcado }))}
          >
            <span
              data-slot="tira-dia-rotulo"
              className={cn('text-xs leading-4 font-bold uppercase', !marcado && 'text-tinta-3')}
            >
              {d.rotulo}
            </span>
            <span
              data-slot="tira-dia-numero"
              className={cn(
                'text-[22px] leading-[26px] font-extrabold',
                !marcado && (d.situacao === 'cheio' ? 'text-tinta-3' : 'text-tinta'),
              )}
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
              data-slot="tira-ponto"
              aria-hidden="true"
              className={cn(pontoDaTiraVariants({ situacao: d.situacao, marcado }))}
            />
          </button>
        );
      })}

      {/* "Outro dia": o `<input type="date">` nativo cobre a ficha inteira, e o
          `<label>` como contêiner dá a ele o nome acessível visível. Nada de
          retângulo tracejado mudo — a data-limite está escrita.

          **Por que aqui continua nativo, contra a fidelidade ao shadcn.** Esta é
          a única superfície do produto que é do cliente final, no celular dele,
          e o seletor nativo é o do sistema: já traduzido, já acessível, já
          conhecido, e abre em tela cheia sem custar JS. O `Popover`+`Calendar`
          da lib ganha no desktop do painel — onde ele foi adotado —, mas num
          telefone ele é um calendário desenhado por nós concorrendo com o que a
          pessoa usa em todos os outros aplicativos. Se um dia a decisão mudar, é
          trocar este bloco pelo mesmo par usado em `barra-de-data.tsx`. */}
      <label data-slot="tira-outro-dia" className={cn(outroDiaVariants({ marcado: foraDaTira }))}>
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
