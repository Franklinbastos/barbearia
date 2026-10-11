import { Ban } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BloqueioDaAgenda } from './folgas';

/**
 * Sem motivo escrito, o bloqueio diz só o que é: "Folga" quando cobre o
 * expediente todo do dia, "Bloqueado" quando é parcial (decisão de 19/09/2026).
 */
export const SEM_MOTIVO = 'Bloqueado';
export const SEM_MOTIVO_DIA_INTEIRO = 'Folga';

export function textoDoBloqueio(
  bloqueio: Pick<BloqueioDaAgenda, 'startAt' | 'endAt' | 'reason' | 'diaInteiro'>,
  timeZone: string,
  nomeDoBarbeiro?: string,
): string {
  const intervalo = `${formatTime(bloqueio.startAt, timeZone)}–${formatTime(bloqueio.endAt, timeZone)}`;
  const motivo = bloqueio.reason?.trim() || (bloqueio.diaInteiro ? SEM_MOTIVO_DIA_INTEIRO : SEM_MOTIVO);
  return [intervalo, nomeDoBarbeiro, motivo].filter(Boolean).join(' · ');
}

/**
 * Folga ou almoço na lista do dia, na mesma ordem de relógio dos atendimentos.
 *
 * Existe para o dono ver **antes** de remarcar ou encaixar que ali não dá — a
 * decisão de 19/09/2026 foi linha própria, em cinza, com o motivo que o dono
 * escreveu. Não é botão: não há ação sobre o bloqueio aqui (ele se edita em
 * Equipe), e um alvo clicável sem ação seria um convite falso.
 */
export function LinhaDeBloqueio({
  bloqueio,
  timeZone,
  nomeDoBarbeiro,
  className,
}: {
  bloqueio: BloqueioDaAgenda;
  timeZone: string;
  /** Omitido quando a loja tem um barbeiro só — repetir o nome não informa nada. */
  nomeDoBarbeiro?: string;
  className?: string;
}) {
  return (
    <li data-slot="bloqueio" className={cn('px-3 py-1', className)}>
      <p className="flex min-h-11 items-center gap-2 rounded-cx bg-superficie-2 px-3 text-[14px] leading-5 text-tinta-2">
        <Ban aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 break-words">{textoDoBloqueio(bloqueio, timeZone, nomeDoBarbeiro)}</span>
      </p>
    </li>
  );
}
