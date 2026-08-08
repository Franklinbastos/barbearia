import { formatTime } from '@/lib/format';
import type { AvailabilitySlot } from './types';

/**
 * Uma ficha da grade de horários.
 *
 * `quantidade` é quantos barbeiros estão livres naquele instante: com
 * "Qualquer barbeiro" a grade mostra a hora uma vez só e escreve "3 livres" na
 * segunda linha, em vez de desenhar três fichas iguais.
 */
export type Horario = {
  startAt: string;
  /** "09:00" — hora local da barbearia. Vira o `data-hora` do botão. */
  hora: string;
  staffId?: string;
  staffName?: string;
  quantidade: number;
};

export type BlocosDeHorario = { manha: Horario[]; tarde: Horario[]; noite: Horario[] };

/** Fronteiras da §5.4, sempre no fuso da barbearia. */
function blocoDaHora(hora: string): keyof BlocosDeHorario {
  const h = Number(hora.slice(0, 2));
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}

/**
 * Transforma a resposta crua da API nas três faixas do dia.
 *
 * `getAvailability` empilha **um slot por barbeiro por horário** (o laço
 * `for (const barbeiro of equipe)` de `availability-service.ts`), então três
 * barbeiros livres às 09:00 chegam como três slots. Com
 * `barbeiroEscolhido === false` isso vira uma ficha só, e — o ponto que mais
 * importa — a ficha sai **sem `staffId`**: quem distribui é `escolherBarbeiro`
 * no servidor, que desempata por carga. Fixar o barbeiro aqui, como a tela
 * fazia antes, desligava esse balanceamento sem ninguém perceber.
 */
export function agruparHorarios(
  slots: AvailabilitySlot[],
  timeZone: string,
  barbeiroEscolhido: boolean,
): BlocosDeHorario {
  const blocos: BlocosDeHorario = { manha: [], tarde: [], noite: [] };

  const fichas: Horario[] = barbeiroEscolhido
    ? slots.map((s) => ({
        startAt: s.startAt,
        hora: formatTime(s.startAt, timeZone),
        staffId: s.staffId,
        staffName: s.staffName,
        quantidade: 1,
      }))
    : agrupadasPorInstante(slots, timeZone);

  for (const ficha of fichas) blocos[blocoDaHora(ficha.hora)].push(ficha);

  for (const bloco of Object.values(blocos)) {
    bloco.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  return blocos;
}

function agrupadasPorInstante(slots: AvailabilitySlot[], timeZone: string): Horario[] {
  const porInstante = new Map<string, Horario>();

  for (const s of slots) {
    // A chave é o instante em milissegundos: dois ISOs diferentes ("…Z" e
    // "…+00:00") podem ser o mesmo horário, e o cliente não pode ver a ficha
    // duas vezes por causa de formatação.
    const chave = String(new Date(s.startAt).getTime());
    const ja = porInstante.get(chave);

    if (ja) {
      ja.quantidade += 1;
      continue;
    }

    porInstante.set(chave, {
      startAt: s.startAt,
      hora: formatTime(s.startAt, timeZone),
      quantidade: 1,
    });
  }

  return [...porInstante.values()];
}
