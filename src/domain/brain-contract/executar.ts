import { createAppointment, cancelAppointment } from '@/domain/booking';
import type { Db } from '@/db/repositories';
import type { ResultadoDaAcao, LojaDoBrain, ServicoDoBrain, BarbeiroDoBrain } from './tipos';
import { OP_MARCAR, OP_CANCELAR } from './catalogo';
import { acharPorNome, montarInicio } from './mapeamento';
import { comoErroDeNegocio } from './erros';

type PayloadDeExecucao = {
  serviceName?: string;
  staffName?: string;
  sessionDate?: string;
  sessionTime?: string;
  clientName?: string;
  /**
   * A barbearia identifica o cliente pelo telefone (é a chave do cadastro e o
   * destino do WhatsApp). O payload agnóstico do contrato não carrega telefone,
   * então a casca o exige como campo próprio: sem ele, não dá para marcar.
   */
  customerPhone?: string;
  appointmentId?: string;
};

export type PedidoDeExecucao = {
  actionName: string;
  idempotencyKey: string;
  externalReference?: string | null;
  payload?: PayloadDeExecucao;
};

function classificarAcao(nome: string): typeof OP_MARCAR | typeof OP_CANCELAR | 'desconhecido' {
  const a = nome.trim().toLowerCase();
  if (a.includes('marcar') || a.includes('agendar') || a.includes('create')) return OP_MARCAR;
  if (a.includes('cancelar') || a.includes('desmarcar') || a.includes('cancel')) return OP_CANCELAR;
  return 'desconhecido';
}

function recusar(pedido: PedidoDeExecucao, message: string, code: string | null = null): ResultadoDaAcao {
  return {
    status: 'REJECTED',
    code,
    actionName: pedido.actionName,
    idempotencyKey: pedido.idempotencyKey,
    externalReference: pedido.externalReference ?? null,
    message,
  };
}

/**
 * Executa de verdade: cria o agendamento com `origin: 'BOT'` (o enum já prevê)
 * ou cancela, reusando `createAppointment`/`cancelAppointment`. Nenhuma regra
 * nova — só a tradução do contrato para as funções que a barbearia já tem.
 *
 * Idempotência: a chave é aceita e ecoada, mas a de-duplicação real (mesma
 * chave = mesmo resultado) depende de um armazém de chaves, que é aditivo e
 * ficou para depois; a constraint `EXCLUDE` do banco já barra marcar o mesmo
 * horário duas vezes (vira SlotTaken).
 */
export async function executar(
  db: Db,
  loja: LojaDoBrain,
  servicos: ServicoDoBrain[],
  equipe: BarbeiroDoBrain[],
  pedido: PedidoDeExecucao,
): Promise<ResultadoDaAcao> {
  if (!pedido.idempotencyKey || pedido.idempotencyKey.trim() === '') {
    return recusar({ ...pedido, idempotencyKey: '' }, 'idempotencyKey é obrigatório.', 'MISSING_IDEMPOTENCY_KEY');
  }

  const acao = classificarAcao(pedido.actionName);
  const p = pedido.payload ?? {};

  if (acao === OP_MARCAR) {
    const nome = (p.clientName ?? '').trim();
    const telefone = (p.customerPhone ?? '').replace(/\D/g, '');
    if (nome === '' || telefone === '') {
      return recusar(pedido, 'Preciso do nome e do telefone do cliente para marcar.', 'MISSING_CUSTOMER');
    }
    const servico = acharPorNome(servicos, p.serviceName);
    if (!servico) {
      return recusar(pedido, 'Não encontrei esse serviço no cardápio.', 'SERVICE_NOT_FOUND');
    }
    const inicio = montarInicio(p.sessionDate, p.sessionTime, loja.timeZone);
    if (!inicio) {
      return recusar(pedido, 'Data ou horário inválidos.', 'INVALID_DATETIME');
    }
    const barbeiro = acharPorNome(equipe, p.staffName);

    try {
      const criado = await createAppointment(db, {
        barbershopId: loja.id,
        serviceId: servico.id,
        staffId: barbeiro?.id,
        startAt: inicio,
        customer: { name: nome, phone: telefone },
        origin: 'BOT',
      });
      const escolhido = equipe.find((b) => b.id === criado.staffId);
      return {
        status: 'CREATED',
        actionName: pedido.actionName,
        idempotencyKey: pedido.idempotencyKey,
        externalReference: pedido.externalReference ?? null,
        appointmentId: criado.appointmentId,
        startAt: criado.startAt.toISOString(),
        staffId: criado.staffId,
        staffName: escolhido?.name,
        message: 'Horário marcado.',
      };
    } catch (erro) {
      const negocio = comoErroDeNegocio(erro);
      if (negocio) return recusar(pedido, negocio.message, negocio.code);
      throw erro;
    }
  }

  if (acao === OP_CANCELAR) {
    const id = p.appointmentId ?? pedido.externalReference ?? undefined;
    if (!id) {
      return recusar(pedido, 'Me diga qual agendamento cancelar.', 'MISSING_APPOINTMENT');
    }
    try {
      // Origem CUSTOMER: o bot age em nome do cliente, então vale a mesma
      // guarda restrita do link (só BOOKED e ainda no futuro).
      await cancelAppointment(db, loja.id, id, { origin: 'CUSTOMER' });
      return {
        status: 'CANCELED',
        actionName: pedido.actionName,
        idempotencyKey: pedido.idempotencyKey,
        externalReference: pedido.externalReference ?? null,
        appointmentId: id,
        message: 'Horário cancelado.',
      };
    } catch (erro) {
      const negocio = comoErroDeNegocio(erro);
      if (negocio) return recusar(pedido, negocio.message, negocio.code);
      throw erro;
    }
  }

  return recusar(pedido, 'Operação desconhecida.', 'UNKNOWN_ACTION');
}
