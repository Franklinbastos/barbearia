'use client';

import { agruparHorarios, type BlocosDeHorario } from '@/app/b/[slug]/agrupar-horarios';
import type { AvailabilitySlot } from '@/app/b/[slug]/types';

export type EscolhaDeHorario = { startAt: string; staffId?: string; staffName?: string };

export type GradeDeHorariosProps = {
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
 */
export function GradeDeHorarios({
  slots,
  timeZone,
  barbeiroEscolhido,
  aoEscolher,
}: GradeDeHorariosProps) {
  const blocos = agruparHorarios(slots, timeZone, barbeiroEscolhido);
  const total = blocos.manha.length + blocos.tarde.length + blocos.noite.length;

  return (
    <div>
      <p className="flex min-h-5 items-center text-xs leading-4 font-bold tracking-[0.06em] text-tinta-3 uppercase">
        {total === 1 ? '1 horário livre' : `${total} horários livres`}
      </p>

      {BLOCOS.map(({ chave, titulo }) => {
        const fichas = blocos[chave];
        // Bloco sem horário some inteiro: um cabeçalho "NOITE" vazio diz menos
        // que a ausência dele.
        if (fichas.length === 0) return null;

        return (
          <section key={chave}>
            <h3 className="mt-4 flex min-h-8 items-center border-b border-linha text-xs leading-4 font-bold tracking-[0.06em] text-tinta-3 uppercase">
              {titulo}
            </h3>
            <ul className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-4">
              {fichas.map((h) => (
                <li key={h.startAt}>
                  <button
                    type="button"
                    data-testid="slot"
                    data-hora={h.hora}
                    onClick={() =>
                      aoEscolher({ startAt: h.startAt, staffId: h.staffId, staffName: h.staffName })
                    }
                    className="flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-cx border border-linha bg-bg md:min-h-14"
                  >
                    <span className="text-[22px] leading-[26px] font-extrabold text-tinta">
                      {h.hora}
                    </span>
                    {h.quantidade > 1 ? (
                      <span className="text-xs leading-4 text-tinta-3">{h.quantidade} livres</span>
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
