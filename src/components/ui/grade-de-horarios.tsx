'use client';

import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { agruparHorarios, type BlocosDeHorario } from '@/app/b/[slug]/agrupar-horarios';
import type { AvailabilitySlot } from '@/app/b/[slug]/types';

export type EscolhaDeHorario = { startAt: string; staffId?: string; staffName?: string };

export type GradeDeHorariosProps = Omit<ComponentProps<'div'>, 'children' | 'onSelect'> & {
  /** Como vêm da API: um slot por barbeiro por horário. */
  slots: AvailabilitySlot[];
  timeZone: string;
  /** `false` ⇒ deduplica por `startAt` e manda `staffId` undefined. */
  barbeiroEscolhido: boolean;
  aoEscolher: (escolha: EscolhaDeHorario) => void;
};

const BLOCOS: { chave: keyof BlocosDeHorario; titulo: string }[] = [
  { chave: 'manha', titulo: 'Manhã' },
  { chave: 'tarde', titulo: 'Tarde' },
  { chave: 'noite', titulo: 'Noite' },
];

/**
 * O rótulo de seção da §5.4: 12/16, negrito, caixa alta e `--tinta-3`. Vale
 * para a contagem do topo e para os três títulos de faixa, que só diferem na
 * altura mínima e no fio embaixo.
 */
export const rotuloDaGradeVariants = cva(
  'flex items-center text-xs leading-4 font-bold tracking-[0.06em] text-tinta-3 uppercase',
  {
    variants: {
      papel: {
        contagem: 'min-h-5',
        faixa: 'mt-4 min-h-8 border-b border-linha',
      },
    },
    defaultVariants: { papel: 'contagem' },
  },
);

/**
 * A ficha de horário. 64px no celular e 56px a partir de 768px — a §5.4 pede o
 * alvo maior justamente onde o dedo é a única entrada.
 */
export const fichaDeHorarioVariants = cva(
  'flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-cx border border-linha bg-bg md:min-h-14',
);

/**
 * A grade de horários do dia (§5.4), em três faixas.
 *
 * Duas coisas que a lista de hoje não faz: separar manhã/tarde/noite — que é o
 * que responde "quando este dia está cheio" — e **deduplicar**. Com três
 * barbeiros livres às 09:00 a tela desenhava "09:00 — João", "09:00 — Pedro" e
 * "09:00 — Ana"; agora é uma ficha "09:00 / 3 livres" que manda `staffId`
 * undefined e deixa o servidor desempatar por carga.
 *
 * `data-testid="slot"` continua sendo o único acoplamento estrutural dos e2e, e
 * `data-hora` é o gancho novo: o nome do barbeiro desceu de linha e ler a hora
 * do `textContent` não funciona mais.
 *
 * **Por que não veio do shadcn.** Não há equivalente: as faixas por período e a
 * deduplicação são regra de domínio, não componente de biblioteca. Segue o
 * padrão da casa por dentro — `cva`, `cn` e `data-slot` nas partes.
 */
export function GradeDeHorarios({
  slots,
  timeZone,
  barbeiroEscolhido,
  aoEscolher,
  className,
  ...resto
}: GradeDeHorariosProps) {
  const blocos = agruparHorarios(slots, timeZone, barbeiroEscolhido);
  const total = blocos.manha.length + blocos.tarde.length + blocos.noite.length;

  // A raiz não carrega classe nenhuma de propósito: quem dá a folga é o passo
  // que a usa. O `cn` está aqui para a `className` de fora chegar inteira.
  return (
    <div data-slot="grade-de-horarios" className={cn(className)} {...resto}>
      <p data-slot="grade-contagem" className={cn(rotuloDaGradeVariants({ papel: 'contagem' }))}>
        {total === 1 ? '1 horário livre' : `${total} horários livres`}
      </p>

      {BLOCOS.map(({ chave, titulo }) => {
        const fichas = blocos[chave];
        // Bloco sem horário some inteiro: um cabeçalho "NOITE" vazio diz menos
        // que a ausência dele.
        if (fichas.length === 0) return null;

        return (
          <section key={chave} data-slot="grade-faixa" data-faixa={chave}>
            <h3 data-slot="grade-faixa-titulo" className={cn(rotuloDaGradeVariants({ papel: 'faixa' }))}>
              {titulo}
            </h3>
            <ul data-slot="grade-lista" className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-4">
              {fichas.map((h) => (
                <li key={h.startAt}>
                  <button
                    type="button"
                    data-slot="grade-horario"
                    data-testid="slot"
                    data-hora={h.hora}
                    onClick={() =>
                      aoEscolher({ startAt: h.startAt, staffId: h.staffId, staffName: h.staffName })
                    }
                    className={cn(fichaDeHorarioVariants())}
                  >
                    <span
                      data-slot="grade-horario-hora"
                      className="text-[22px] leading-[26px] font-extrabold text-tinta"
                    >
                      {h.hora}
                    </span>
                    {h.quantidade > 1 ? (
                      <span
                        data-slot="grade-horario-quantidade"
                        className="text-xs leading-4 text-tinta-3"
                      >
                        {h.quantidade} livres
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
