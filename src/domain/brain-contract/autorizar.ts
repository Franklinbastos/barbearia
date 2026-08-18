import { getAvailability } from '@/domain/booking';
import { findAppointmentById, type Db } from '@/db/repositories';
import type { RespostaDeAutorizacao, LojaDoBrain, ServicoDoBrain, BarbeiroDoBrain } from './tipos';
import { OP_MARCAR, OP_CANCELAR, OP_REMARCAR } from './catalogo';
import { acharPorNome, montarInicio } from './mapeamento';
import { comoErroDeNegocio } from './erros';

type SlotsDaAutorizacao = {
  serviceName?: string;
  staffName?: string;
  sessionDate?: string;
  sessionTime?: string;
  appointmentId?: string;
};

export type PedidoDeAutorizacao = {
  intent: string;
  slots?: SlotsDaAutorizacao;
  externalReference?: string | null;
};

/** Antecedência mínima padrão (24h) para alterar/cancelar quando a loja não configurou. */
const ANTECEDENCIA_PADRAO_MIN = 24 * 60;

export const MSG_EM_CIMA_DA_HORA =
  'Esse horário já está muito próximo — pra alterar ou cancelar em cima da hora, é melhor '
  + 'falar direto com a barbearia. Quer que eu te passe pra uma pessoa? É só dizer "atendente".';

/**
 * O horário-alvo está dentro da janela mínima de antecedência para mexer? Ação crítica em cima
 * da hora não é do bot: vira handoff. `minChangeMinutes` vem da loja; ausente, vale o padrão.
 */
export function emCimaDaHora(startAt: Date, loja: LojaDoBrain, agora: Date): boolean {
  const minutos = loja.minChangeMinutes ?? ANTECEDENCIA_PADRAO_MIN;
  return startAt.getTime() < agora.getTime() + minutos * 60_000;
}

type IntentConhecido = typeof OP_MARCAR | typeof OP_CANCELAR | typeof OP_REMARCAR;

function classificarIntent(intent: string): IntentConhecido | 'desconhecido' {
  const i = intent.trim().toLowerCase();
  // Remarcar antes de marcar: "remarcar"/"reagendar" contêm "marcar"/"agendar".
  if (i.includes('remarcar') || i.includes('reagendar') || i === OP_REMARCAR) return OP_REMARCAR;
  if (i.includes('marcar') || i.includes('agendar') || i === OP_MARCAR) return OP_MARCAR;
  if (i.includes('cancelar') || i.includes('desmarcar') || i === OP_CANCELAR) return OP_CANCELAR;
  return 'desconhecido';
}

/**
 * Valida a escolha do cliente sem gravar nada (dry-run). Repete a mesma
 * validação do `createAppointment`/`cancelAppointment` — grade recalculada,
 * janela e estado do agendamento — só que responde `allowed`/`message` em vez
 * de persistir. Serve para o brain confirmar antes de mandar o `execute`.
 *
 * Casa com `authorize-response.schema.json`: `{ allowed, message }`.
 */
export async function autorizar(
  db: Db,
  loja: LojaDoBrain,
  servicos: ServicoDoBrain[],
  equipe: BarbeiroDoBrain[],
  pedido: PedidoDeAutorizacao,
  agora: Date = new Date(),
): Promise<RespostaDeAutorizacao> {
  const tipo = classificarIntent(pedido.intent);
  const slots = pedido.slots ?? {};

  if (tipo === OP_MARCAR) {
    const servico = acharPorNome(servicos, slots.serviceName);
    if (!servico) {
      return { allowed: false, message: 'Não encontrei esse serviço no cardápio da barbearia.' };
    }
    const inicio = montarInicio(slots.sessionDate, slots.sessionTime, loja.timeZone);
    if (!inicio) {
      return { allowed: false, message: 'Preciso de uma data e um horário válidos para conferir.' };
    }
    const barbeiro = acharPorNome(equipe, slots.staffName);

    let livres;
    try {
      livres = await getAvailability(db, {
        barbershopId: loja.id,
        serviceId: servico.id,
        staffId: barbeiro?.id,
        date: slots.sessionDate!,
        now: agora,
      });
    } catch (erro) {
      const negocio = comoErroDeNegocio(erro);
      if (negocio) return { allowed: false, message: negocio.message };
      throw erro;
    }

    const livre = livres.some((s) => s.start.getTime() === inicio.getTime());
    return livre
      ? { allowed: true, message: 'Esse horário está livre — é só confirmar.' }
      : { allowed: false, message: 'Esse horário não está mais livre. Quer ver outros?' };
  }

  if (tipo === OP_CANCELAR) {
    const id = slots.appointmentId ?? pedido.externalReference ?? undefined;
    if (!id) {
      return { allowed: false, message: 'Me diga qual agendamento você quer cancelar.' };
    }
    const marcado = await findAppointmentById(db, loja.id, id);
    if (!marcado || marcado.status === 'CANCELED') {
      return { allowed: false, message: 'Não encontrei esse agendamento.' };
    }
    if (marcado.status !== 'BOOKED') {
      return { allowed: false, message: 'Esse atendimento já foi fechado pela barbearia.' };
    }
    if (marcado.startAt.getTime() <= agora.getTime()) {
      return {
        allowed: false,
        message: 'Esse horário já começou. Para cancelar, fale com a barbearia.',
      };
    }
    if (emCimaDaHora(marcado.startAt, loja, agora)) {
      return { allowed: false, message: MSG_EM_CIMA_DA_HORA, code: 'HANDOFF' };
    }
    return { allowed: true, message: 'Pode cancelar — é só confirmar.' };
  }

  if (tipo === OP_REMARCAR) {
    // Mesma guarda de alvo do cancelar: a reserva tem de existir, estar BOOKED e no futuro.
    const id = slots.appointmentId ?? pedido.externalReference ?? undefined;
    if (!id) {
      return { allowed: false, message: 'Me diga qual agendamento você quer remarcar.' };
    }
    const marcado = await findAppointmentById(db, loja.id, id);
    if (!marcado || marcado.status === 'CANCELED') {
      return { allowed: false, message: 'Não encontrei esse agendamento.' };
    }
    if (marcado.status !== 'BOOKED') {
      return { allowed: false, message: 'Esse atendimento já foi fechado pela barbearia.' };
    }
    if (marcado.startAt.getTime() <= agora.getTime()) {
      return {
        allowed: false,
        message: 'Esse horário já começou. Para remarcar, fale com a barbearia.',
      };
    }
    if (emCimaDaHora(marcado.startAt, loja, agora)) {
      return { allowed: false, message: MSG_EM_CIMA_DA_HORA, code: 'HANDOFF' };
    }
    // Data/hora novas têm de ser válidas (o motor semeia as atuais quando o cliente só troca
    // o barbeiro). A colisão do novo horário é decidida na execução pela constraint EXCLUDE
    // (que ignora a própria reserva ao movê-la) — se der conflito, o motor re-oferece.
    const inicio = montarInicio(slots.sessionDate, slots.sessionTime, loja.timeZone);
    if (!inicio) {
      return { allowed: false, message: 'Preciso de uma data e um horário válidos para remarcar.' };
    }
    return { allowed: true, message: 'Posso remarcar — é só confirmar.' };
  }

  return { allowed: false, message: 'Não sei fazer isso por aqui.' };
}
