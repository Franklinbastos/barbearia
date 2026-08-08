import type { AgendaAppointment, AgendaStaff } from './day-grid';

/**
 * "Quem está livre agora?" — a resposta de balcão, sem quadro de colunas.
 *
 * É calculada dos **mesmos** `appointments` que a página da agenda já carregou:
 * zero consulta nova. Roda no servidor e no cliente, e não conhece componente
 * nenhum — é o que a torna testável linha a linha.
 */

/** O mínimo que a conta precisa saber de um atendimento. */
export type AtendimentoParaLivres = Pick<
  AgendaAppointment,
  'staffId' | 'startAt' | 'endAt' | 'status'
>;

/** O mínimo que a conta precisa saber de um barbeiro. */
export type BarbeiroParaLivres = Pick<AgendaStaff, 'id'>;

export type ProximoLivre = { staffId: string; horaISO: string | null };

/**
 * Só `BOOKED` ocupa a cadeira.
 *
 * `CANCELED` nunca ocupou. `DONE` e `NO_SHOW` são passado resolvido — se o
 * atendente já bateu "Compareceu" às 10h05 num horário que ia até 10h30, o
 * barbeiro **está** livre, e dizer o contrário faz o balcão recusar um encaixe
 * que cabe.
 */
function ocupa(a: AtendimentoParaLivres): boolean {
  return a.status === 'BOOKED';
}

/**
 * Para cada barbeiro da equipe, o instante em que ele fica livre a partir de
 * `agora`. Livre agora ⇒ o próprio `agora`.
 *
 * A varredura é em ordem de início: enquanto o próximo atendimento começar
 * antes (ou exatamente em cima) do instante candidato, o candidato pula para o
 * fim daquele atendimento. Atendimentos encostados — 13:30→14:00 logo após
 * 12:30→13:30 — são engolidos pelo mesmo laço, e o que sobra é o primeiro
 * buraco de verdade.
 *
 * Devolve **uma entrada por barbeiro, sempre**, na ordem em que a equipe veio:
 * barbeiro sem nenhum atendimento no dia é justamente o que o balcão procura, e
 * sumir da linha seria o oposto do útil. `horaISO` só é `null` quando algum
 * atendimento chega com data inválida — aí não se inventa uma hora.
 */
export function calcularProximosLivres(
  appointments: AtendimentoParaLivres[],
  staffList: BarbeiroParaLivres[],
  agora: Date,
): ProximoLivre[] {
  const porBarbeiro = new Map<string, AtendimentoParaLivres[]>();
  for (const a of appointments) {
    if (!ocupa(a)) continue;
    const lista = porBarbeiro.get(a.staffId);
    if (lista) lista.push(a);
    else porBarbeiro.set(a.staffId, [a]);
  }

  return staffList.map((barbeiro) => {
    const agenda = (porBarbeiro.get(barbeiro.id) ?? [])
      .slice()
      .sort((x, y) => x.startAt.getTime() - y.startAt.getTime());

    let livre = agora.getTime();
    if (Number.isNaN(livre)) return { staffId: barbeiro.id, horaISO: null };

    for (const a of agenda) {
      const inicio = a.startAt.getTime();
      const fim = a.endAt.getTime();
      if (Number.isNaN(inicio) || Number.isNaN(fim)) {
        return { staffId: barbeiro.id, horaISO: null };
      }
      // Terminou antes do candidato: passado, não conta.
      if (fim <= livre) continue;
      // Começa depois do candidato: achamos o buraco.
      if (inicio > livre) break;
      livre = fim;
    }

    return { staffId: barbeiro.id, horaISO: new Date(livre).toISOString() };
  });
}
