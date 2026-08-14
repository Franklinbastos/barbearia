import { getAvailability } from '@/domain/booking';
import { findAppointmentById, type Db } from '@/db/repositories';
import type { RespostaDeAutorizacao, LojaDoBrain, ServicoDoBrain, BarbeiroDoBrain } from './tipos';
import { OP_MARCAR, OP_CANCELAR } from './catalogo';
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

function classificarIntent(intent: string): typeof OP_MARCAR | typeof OP_CANCELAR | 'desconhecido' {
  const i = intent.trim().toLowerCase();
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
    return { allowed: true, message: 'Pode cancelar — é só confirmar.' };
  }

  return { allowed: false, message: 'Não sei fazer isso por aqui.' };
}
