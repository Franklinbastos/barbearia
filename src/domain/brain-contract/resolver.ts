import { DateTime } from 'luxon';
import { getAvailability } from '@/domain/booking';
import { escolherBarbeiro } from '@/domain/booking/create-appointment';
import type { Db } from '@/db/repositories';
import { listFutureAppointmentsByCustomerPhone } from '@/db/repositories';
import { comoErroDeNegocio } from './erros';
import type {
  Candidato,
  RespostaDeResolucao,
  LojaDoBrain,
  ServicoDoBrain,
  BarbeiroDoBrain,
} from './tipos';
import { acharPorNome, formatarPreco, horaLocal } from './mapeamento';

/** Slots que os candidatos do `resolve` sabem preencher, já normalizados. */
type SlotAlvo = 'serviceName' | 'staffName' | 'sessionTime' | 'appointmentId' | 'desconhecido';

type SlotsDaResolucao = {
  serviceName?: string;
  staffName?: string;
  sessionDate?: string;
  customerPhone?: string;
};

export type PedidoDeResolucao = {
  slotToResolve: string;
  resolverKey?: string;
  slots?: SlotsDaResolucao;
  limit?: number | null;
};

function classificarSlot(slot: string): SlotAlvo {
  const s = slot.trim().toLowerCase();
  if (s === 'servicename' || s === 'servico' || s === 'serviço') return 'serviceName';
  if (s === 'staffname' || s === 'profissional' || s === 'barbeiro') return 'staffName';
  if (s === 'sessiontime' || s === 'horario' || s === 'horário' || s === 'hora') {
    return 'sessionTime';
  }
  if (s === 'appointmentid' || s === 'agendamento') return 'appointmentId';
  return 'desconhecido';
}

/**
 * Dá ao brain a lista de candidatos para o slot que falta. É a única porta que
 * toca o banco (via `getAvailability`); a montagem dos candidatos é pura.
 *
 * - `serviceName` / `staffName`: devolve o catálogo já carregado, sem ir ao banco.
 * - `sessionTime`: reusa `getAvailability` — a mesma grade da página pública,
 *   com janela, expediente e colisão. Sem serviço ou sem data, não há o que
 *   resolver, e a mensagem diz o que falta em vez de devolver lista vazia muda.
 */
export async function resolverCandidatos(
  db: Db,
  loja: LojaDoBrain,
  servicos: ServicoDoBrain[],
  equipe: BarbeiroDoBrain[],
  pedido: PedidoDeResolucao,
): Promise<RespostaDeResolucao> {
  const resolverKey = pedido.resolverKey ?? 'session';
  const alvo = classificarSlot(pedido.slotToResolve);
  const slots = pedido.slots ?? {};
  const teto = pedido.limit && pedido.limit > 0 ? pedido.limit : undefined;

  const base = { slotToResolve: pedido.slotToResolve, resolverKey };

  if (alvo === 'serviceName') {
    const candidates: Candidato[] = servicos.map((s) => ({
      id: s.name,
      label: `${s.name} · ${s.durationMinutes} min · ${formatarPreco(s.priceCents)}`,
      fields: {
        serviceId: s.id,
        serviceName: s.name,
        durationMinutes: String(s.durationMinutes),
        priceCents: String(s.priceCents),
      },
    }));
    return { ...base, candidates };
  }

  if (alvo === 'staffName') {
    const candidates: Candidato[] = equipe.map((b) => ({
      id: b.name,
      label: b.name,
      fields: { staffId: b.id, staffName: b.name },
    }));
    return { ...base, candidates };
  }

  if (alvo === 'sessionTime') {
    const servico = acharPorNome(servicos, slots.serviceName);
    if (!servico) {
      return {
        ...base,
        candidates: [],
        message: 'Me diga primeiro qual serviço você quer.',
      };
    }
    if (!slots.sessionDate) {
      return { ...base, candidates: [], message: 'Para qual dia?' };
    }
    const barbeiro = acharPorNome(equipe, slots.staffName);

    let livres;
    try {
      livres = await getAvailability(db, {
        barbershopId: loja.id,
        serviceId: servico.id,
        staffId: barbeiro?.id,
        date: slots.sessionDate,
      });
    } catch (erro) {
      const negocio = comoErroDeNegocio(erro);
      if (negocio) return { ...base, candidates: [], message: negocio.message };
      throw erro;
    }

    // Um candidato por horário: para escolher a hora, o cliente não precisa ver
    // o mesmo horário repetido por barbeiro. Com múltiplos barbeiros livres no
    // mesmo horário, escolhe o com menos agendamentos naquele dia; empate mantém
    // ordem alfabética.
    const mapa = new Map<string, typeof livres>();
    for (const slot of livres) {
      const hora = horaLocal(slot.start, loja.timeZone);
      if (!mapa.has(hora)) mapa.set(hora, []);
      mapa.get(hora)!.push(slot);
    }

    const dia = DateTime.fromISO(slots.sessionDate, { zone: loja.timeZone });
    const candidates: Candidato[] = [];
    for (const [hora, slotsParaHora] of mapa) {
      const escolhido = await escolherBarbeiro(db, loja.id, slotsParaHora, dia);
      candidates.push({
        id: hora,
        label: hora,
        fields: {
          sessionTime: hora,
          staffId: escolhido.staffId,
          staffName: escolhido.staffName,
          startAt: escolhido.start.toISOString(),
        },
      });
      if (teto && candidates.length >= teto) break;
    }
    return { ...base, candidates };
  }

  if (alvo === 'appointmentId') {
    const telefone = slots.customerPhone;
    if (!telefone) {
      return {
        ...base,
        candidates: [],
        message: 'Preciso do seu telefone para buscar os agendamentos.',
      };
    }

    const agendamentos = await listFutureAppointmentsByCustomerPhone(
      db,
      loja.id,
      telefone,
      new Date(),
    );

    if (agendamentos.length === 0) {
      return {
        ...base,
        candidates: [],
        message: 'Não achei nenhum horário futuro no seu nome.',
      };
    }

    const candidates: Candidato[] = agendamentos.map((appt) => {
      const dia = DateTime.fromJSDate(appt.startAt).setZone(loja.timeZone);
      const hora = horaLocal(appt.startAt, loja.timeZone);
      const label = `${appt.serviceName}, ${dia.toFormat('cccc dd/MM')} às ${hora} com ${appt.staffName}`;

      return {
        id: appt.id,
        label,
        fields: {
          appointmentId: appt.id,
        },
      };
    });

    return { ...base, candidates };
  }

  return { ...base, candidates: [], message: 'Não sei resolver esse campo.' };
}
