import { DateTime } from 'luxon';

/**
 * Quem folga num dia, e por quê — para a barra de data e o calendário da agenda.
 *
 * Pura, sem banco, no espírito de `proximos-livres.ts`: roda no servidor e no
 * cliente (o calendário recalcula ao trocar de mês) e se testa linha a linha.
 *
 * Duas formas de folga, decididas com o dono do produto em 19/09/2026:
 *
 * - **`semana`** — o barbeiro não tem expediente naquele dia da semana
 *   (ex.: não trabalha às segundas).
 * - **`bloqueio`** — tem expediente, mas os bloqueios do dia cobrem **todo** ele
 *   (ex.: trabalha 9h–19h e o dono bloqueou das 9h às 19h). Bloqueio parcial,
 *   como o almoço, não é folga: vira linha na agenda do dia, não aviso na barra.
 */

/** Uma linha de `working_hours`. `weekday` segue o Luxon: 1 = segunda … 7 = domingo. */
export type Expediente = { staffId: string; weekday: number; startTime: string; endTime: string };

export type BloqueioDaAgenda = {
  id: string;
  staffId: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
  /** O barbeiro está de folga no dia (os bloqueios cobrem todo o expediente). */
  diaInteiro?: boolean;
};

export type Folga = { staffId: string; tipo: 'semana' | 'bloqueio' };

function instanteLocal(diaISO: string, hora: string, timeZone: string): number {
  return DateTime.fromISO(`${diaISO}T${hora}`, { zone: timeZone }).toMillis();
}

/** Os bloqueios cobrem [inicio, fim) inteiro? Bloqueios encadeados contam juntos. */
function cobre(bloqueios: { startAt: Date; endAt: Date }[], inicio: number, fim: number): boolean {
  const ordenados = [...bloqueios].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  let coberto = inicio;
  for (const b of ordenados) {
    if (b.startAt.getTime() > coberto) break;
    coberto = Math.max(coberto, b.endAt.getTime());
    if (coberto >= fim) return true;
  }
  return coberto >= fim;
}

export function folgasDoDia(
  diaISO: string,
  timeZone: string,
  staffList: { id: string }[],
  expedientes: Expediente[],
  bloqueios: Pick<BloqueioDaAgenda, 'staffId' | 'startAt' | 'endAt'>[],
): Folga[] {
  const weekday = DateTime.fromISO(diaISO, { zone: timeZone }).weekday;
  const folgas: Folga[] = [];

  for (const barbeiro of staffList) {
    const seusExpedientes = expedientes.filter((e) => e.staffId === barbeiro.id);
    // Sem expediente nenhum é cadastro incompleto, não folga: marcaria todo dia do
    // calendário. O rodapé do calendário avisa esse caso à parte.
    if (seusExpedientes.length === 0) continue;
    const doDia = seusExpedientes.filter((e) => e.weekday === weekday);
    if (doDia.length === 0) {
      folgas.push({ staffId: barbeiro.id, tipo: 'semana' });
      continue;
    }
    const seus = bloqueios.filter((b) => b.staffId === barbeiro.id);
    const todoCoberto = doDia.every((e) =>
      cobre(seus, instanteLocal(diaISO, e.startTime, timeZone), instanteLocal(diaISO, e.endTime, timeZone)),
    );
    if (todoCoberto) folgas.push({ staffId: barbeiro.id, tipo: 'bloqueio' });
  }

  return folgas;
}

/** Barbeiros com algum expediente cadastrado — os únicos que contam para "a loja abre?". */
function comExpediente(staffList: { id: string }[], expedientes: Expediente[]) {
  return staffList.filter((b) => expedientes.some((e) => e.staffId === b.id));
}

/**
 * **Fechado** é o dia em que ninguém trabalha (decisão de 19/09/2026): não é
 * folga de ninguém, é a loja que não abre — o calendário mostra diferente e a
 * barra diz "Fechado" em vez de listar a equipe inteira.
 */
export function situacaoDoDia(
  diaISO: string,
  timeZone: string,
  staffList: { id: string }[],
  expedientes: Expediente[],
  bloqueios: Pick<BloqueioDaAgenda, 'staffId' | 'startAt' | 'endAt'>[],
): { fechado: boolean; folgas: Folga[] } {
  const folgas = folgasDoDia(diaISO, timeZone, staffList, expedientes, bloqueios);
  const quemTrabalha = comExpediente(staffList, expedientes);
  const fechado = quemTrabalha.length > 0 && quemTrabalha.every((b) => folgas.some((f) => f.staffId === b.id));
  return { fechado, folgas };
}

/**
 * "Pedro de folga · Tiago não trabalha" — o texto da barra de data.
 * Barbeiro fora da lista de nomes (saiu da equipe) não entra.
 */
export function textoDasFolgas(folgas: Folga[], nomes: Map<string, string>, fechado = false): string | null {
  if (fechado) return 'Fechado';
  const partes = folgas
    .filter((f) => nomes.has(f.staffId))
    .map((f) => `${nomes.get(f.staffId)} ${f.tipo === 'semana' ? 'não trabalha' : 'de folga'}`);
  return partes.length > 0 ? partes.join(' · ') : null;
}

/** Com o artigo: "às segundas", mas "aos sábados" e "aos domingos". */
const NOMES_DO_DIA_NO_PLURAL: Record<number, string> = {
  1: 'às segundas', 2: 'às terças', 3: 'às quartas', 4: 'às quintas', 5: 'às sextas',
  6: 'aos sábados', 7: 'aos domingos',
};

/**
 * Resumo das folgas de um mês, para o rodapé do calendário — o único jeito de
 * "ver quem" que funciona no celular, onde não existe passar o mouse.
 *
 * A folga de semana sai **uma vez por barbeiro**, pelo dia da semana ("Tiago não
 * trabalha às segundas"), e não uma linha por segunda do mês. O bloqueio de dia
 * inteiro sai por dia ("7 · Pedro de folga").
 */
export function resumoDoMes(
  ano: number,
  mes: number,
  timeZone: string,
  staffList: { id: string; name: string }[],
  expedientes: Expediente[],
  bloqueios: Pick<BloqueioDaAgenda, 'staffId' | 'startAt' | 'endAt'>[],
): { diasDeFolga: Set<string>; diasFechados: Set<string>; linhas: string[] } {
  const nomes = new Map(staffList.map((b) => [b.id, b.name]));
  const diasDeFolga = new Set<string>();
  const diasFechados = new Set<string>();
  const porDia: string[] = [];

  // Dia da semana em que a loja inteira não abre (ex.: domingo): sai uma vez, como
  // "Fechado aos domingos", e some das linhas de cada barbeiro — "Pedro não
  // trabalha aos domingos" seria repetir a mesma notícia por pessoa.
  const quemTrabalha = comExpediente(staffList, expedientes);
  const trabalhaNaSemana = (staffId: string, w: number) =>
    expedientes.some((e) => e.staffId === staffId && e.weekday === w);
  const fechadosNaSemana = new Set(
    quemTrabalha.length > 0
      ? [1, 2, 3, 4, 5, 6, 7].filter((w) => quemTrabalha.every((b) => !trabalhaNaSemana(b.id, w)))
      : [],
  );

  const primeiro = DateTime.fromObject({ year: ano, month: mes, day: 1 }, { zone: timeZone });
  for (let d = primeiro; d.month === mes; d = d.plus({ days: 1 })) {
    const iso = d.toISODate()!;
    const { fechado, folgas } = situacaoDoDia(iso, timeZone, staffList, expedientes, bloqueios);
    if (fechado) {
      diasFechados.add(iso);
      // Fechado por bloqueio (feriado, todos de folga) é notícia do dia; o da semana já sai abaixo.
      if (!fechadosNaSemana.has(d.weekday)) porDia.push(`${d.day} · Fechado`);
      continue;
    }
    if (folgas.length > 0) diasDeFolga.add(iso);
    for (const f of folgas.filter((x) => x.tipo === 'bloqueio')) {
      porDia.push(`${d.day} · ${nomes.get(f.staffId)} de folga`);
    }
  }

  const semanais: string[] = [];
  if (fechadosNaSemana.size > 0) {
    const dias = [...fechadosNaSemana].sort().map((w) => NOMES_DO_DIA_NO_PLURAL[w]);
    semanais.push(`Fechado ${dias.length === 1 ? dias[0] : `${dias.slice(0, -1).join(', ')} e ${dias.at(-1)}`}`);
  }
  for (const barbeiro of staffList) {
    const trabalha = new Set(expedientes.filter((e) => e.staffId === barbeiro.id).map((e) => e.weekday));
    if (trabalha.size === 0) {
      semanais.push(`${barbeiro.name} sem expediente cadastrado`);
      continue;
    }
    const naoTrabalha = [1, 2, 3, 4, 5, 6, 7].filter((w) => !trabalha.has(w) && !fechadosNaSemana.has(w));
    if (naoTrabalha.length === 0) continue;
    // Quem folga mais dias do que trabalha se descreve pelo que trabalha: "Tiago
    // trabalha só às quartas" em vez de listar seis dias de folga.
    const trabalhaMenos = naoTrabalha.length > 3;
    const dias = (trabalhaMenos ? [...trabalha].sort() : naoTrabalha).map((w) => NOMES_DO_DIA_NO_PLURAL[w]);
    const lista = dias.length === 1 ? dias[0] : `${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]}`;
    semanais.push(trabalhaMenos ? `${barbeiro.name} trabalha só ${lista}` : `${barbeiro.name} não trabalha ${lista}`);
  }

  return { diasDeFolga, diasFechados, linhas: [...porDia, ...semanais] };
}
