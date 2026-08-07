import { appointment } from '@/db/schema';
import {
  findBarbershopById,
  findServiceById,
  findStaffById,
  listBusyRanges,
  listStaffForService,
  upsertCustomer,
  type Db,
} from '@/db/repositories';
import { NotFoundError, SlotTakenError, SlotUnavailableError, isExclusionViolation } from './errors';

/**
 * Encaixe e walk-in do balcão (seção 6 do spec).
 *
 * Caminho próprio, que **não** passa por `getAvailability`: sem grade de
 * `slotMinutes`, sem `minLeadMinutes` e sem `maxAdvanceDays`. São 14:05, o
 * barbeiro está livre e o cliente está na porta — quem decide é o barbeiro, não
 * a grade que a página pública desenha.
 *
 * O que continua valendo, porque não é preferência e sim integridade:
 * barbearia e serviço existem e estão ativos; o barbeiro é daquela barbearia,
 * está ativo e faz aquele serviço; a duração é a efetiva do barbeiro; e o
 * horário não cai em cima de atendimento ativo nem de bloqueio. A constraint
 * `EXCLUDE` é a rede de segurança final e sua violação é tratada como colisão.
 */
export type CreateWalkInInput = {
  barbershopId: string;
  serviceId: string;
  /** Obrigatório: encaixe é sempre com um barbeiro escolhido no balcão. */
  staffId: string;
  startAt: Date;
  customer: { name: string; phone: string };
  /** Injetável para teste; em produção é o relógio do servidor. */
  now?: Date;
};

export const MENSAGEM_DE_COLISAO =
  'O barbeiro já tem atendimento ou bloqueio nesse horário';

/** Teto de sanidade do encaixe: pega erro de digitação de ano, não regra de negócio. */
export const MAX_HORIZONTE_DIAS = 365;

export async function createWalkInAppointment(db: Db, input: CreateWalkInInput) {
  const loja = await findBarbershopById(db, input.barbershopId);
  if (!loja) throw new NotFoundError('Barbearia não encontrada');

  const servico = await findServiceById(db, input.barbershopId, input.serviceId);
  if (!servico || !servico.active) throw new NotFoundError('Serviço não encontrado');

  const inicio = input.startAt;
  if (Number.isNaN(inicio.getTime())) throw new SlotUnavailableError('Horário inválido');

  // O encaixe ignora grade, antecedência mínima e janela de agendamento — quem
  // decide é o barbeiro. Mas horizonte nenhum não é liberdade, é dedo torto:
  // um ano cobre qualquer encaixe legítimo e barra a data digitada errada.
  const agora = input.now ?? new Date();
  const limite = new Date(agora.getTime() + MAX_HORIZONTE_DIAS * 24 * 60 * 60 * 1000);
  if (inicio > limite) {
    throw new SlotUnavailableError(
      `O encaixe não pode passar de ${MAX_HORIZONTE_DIAS} dias. Confira a data.`,
    );
  }

  const barbeiro = await findStaffById(db, input.barbershopId, input.staffId);
  if (!barbeiro || !barbeiro.active) throw new NotFoundError('Barbeiro não encontrado');

  // `listStaffForService` já filtra por barbearia, barbeiro ativo e serviço
  // ativo, e traz a duração com o override do barbeiro aplicado.
  const vinculos = await listStaffForService(db, input.barbershopId, input.serviceId);
  const vinculo = vinculos.find((c) => c.id === input.staffId);
  if (!vinculo) throw new NotFoundError('Esse barbeiro não faz esse serviço');

  const duracao = Number(vinculo.effectiveDurationMinutes);
  if (!Number.isFinite(duracao) || duracao <= 0) {
    throw new SlotUnavailableError('Duração do serviço inválida para esse barbeiro');
  }

  const fim = new Date(inicio.getTime() + duracao * 60_000);

  // Pré-teste com mensagem boa. Só enxerga a própria barbearia, então não
  // substitui a constraint — antecipa o erro comum e evita gastar transação.
  const ocupado = await listBusyRanges(db, input.barbershopId, input.staffId, inicio, fim);
  if (ocupado.length > 0) throw new SlotTakenError(MENSAGEM_DE_COLISAO);

  try {
    // Cliente e agendamento na mesma transação: perder o horário na constraint
    // não pode deixar cliente órfão nem cadastro alterado.
    const linha = await db.transaction(async (tx) => {
      // O balcão é superfície autenticada: aqui o atendente corrige o nome.
      const cliente = await upsertCustomer(tx, input.barbershopId, input.customer, {
        atualizarNome: true,
      });

      const [criado] = await tx
        .insert(appointment)
        .values({
          barbershopId: input.barbershopId,
          staffId: barbeiro.id,
          customerId: cliente.id,
          serviceId: servico.id,
          serviceNameSnapshot: servico.name,
          servicePriceCentsSnapshot: servico.priceCents,
          serviceDurationMinutesSnapshot: duracao,
          startAt: inicio,
          endAt: fim,
          origin: 'PANEL',
        })
        .returning();

      return criado;
    });

    return {
      appointmentId: linha.id,
      staffId: linha.staffId,
      startAt: linha.startAt,
      endAt: linha.endAt,
    };
  } catch (erro) {
    if (isExclusionViolation(erro)) throw new SlotTakenError(MENSAGEM_DE_COLISAO);
    throw erro;
  }
}
