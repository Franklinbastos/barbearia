import { DateTime } from 'luxon';
import { appointment } from '@/db/schema';
import { findBarbershopById, findServiceById, upsertCustomer, type Db } from '@/db/repositories';
import { getAvailability, type AvailabilitySlot } from './availability-service';
import { countAppointmentsByStaff } from './staff-load';
import { NotFoundError, SlotTakenError, SlotUnavailableError, isExclusionViolation } from './errors';
import { assertWithinBookingWindow } from './booking-window';

export type CreateAppointmentInput = {
  barbershopId: string;
  serviceId: string;
  staffId?: string;
  startAt: Date;
  customer: { name: string; phone: string };
  origin: 'PUBLIC' | 'PANEL' | 'BOT';
  now?: Date;
};

/**
 * Desempate do "qualquer barbeiro": entre os que estão livres naquele horário,
 * fica com quem tem menos atendimentos no dia. Empate mantém a ordem que veio
 * da grade, que é alfabética — resultado estável, sem sorteio.
 */
async function escolherBarbeiro(
  db: Db,
  barbershopId: string,
  candidatos: AvailabilitySlot[],
  dia: DateTime,
): Promise<AvailabilitySlot> {
  if (candidatos.length === 1) return candidatos[0];

  const carga = await countAppointmentsByStaff(
    db,
    barbershopId,
    candidatos.map((c) => c.staffId),
    dia.startOf('day').toJSDate(),
    dia.plus({ days: 1 }).startOf('day').toJSDate(),
  );

  return candidatos.reduce((melhor, atual) =>
    (carga.get(atual.staffId) ?? 0) < (carga.get(melhor.staffId) ?? 0) ? atual : melhor,
  );
}

export async function createAppointment(db: Db, input: CreateAppointmentInput) {
  const loja = await findBarbershopById(db, input.barbershopId);
  if (!loja) throw new NotFoundError('Barbearia não encontrada');

  const servico = await findServiceById(db, input.barbershopId, input.serviceId);
  if (!servico || !servico.active) throw new NotFoundError('Serviço não encontrado');

  const dia = DateTime.fromJSDate(input.startAt).setZone(loja.timeZone);
  const date = dia.toISODate()!;

  // A janela vale também aqui, e não só dentro de `getAvailability`: quem manda
  // POST direto não passa pela grade que o navegador desenha. O painel fica de
  // fora — `maxAdvanceDays` limita o que o cliente marca sozinho, e a barbearia
  // que agenda no balcão para daqui a três meses sabe o que está fazendo.
  const aplicarJanela = input.origin !== 'PANEL';
  if (aplicarJanela) assertWithinBookingWindow(loja, dia, input.now ?? new Date());

  // Recalcula sempre: o horário que o navegador mostrou é sugestão, não reserva.
  const disponiveis = await getAvailability(db, {
    barbershopId: input.barbershopId,
    serviceId: input.serviceId,
    staffId: input.staffId,
    date,
    now: input.now,
    enforceWindow: aplicarJanela,
  });

  const candidatos = disponiveis.filter((s) => s.start.getTime() === input.startAt.getTime());
  if (candidatos.length === 0) throw new SlotUnavailableError();

  const escolhido = await escolherBarbeiro(db, input.barbershopId, candidatos, dia);

  try {
    // Cliente e agendamento na mesma transação: perder o horário na constraint
    // não pode deixar o cadastro do cliente alterado nem cliente órfão.
    const linha = await db.transaction(async (tx) => {
      const cliente = await upsertCustomer(tx, input.barbershopId, input.customer, {
        // Só o painel é superfície autenticada; público e bot não renomeiam.
        atualizarNome: input.origin === 'PANEL',
      });

      const [criado] = await tx
        .insert(appointment)
        .values({
          barbershopId: input.barbershopId,
          staffId: escolhido.staffId,
          customerId: cliente.id,
          serviceId: servico.id,
          serviceNameSnapshot: servico.name,
          servicePriceCentsSnapshot: servico.priceCents,
          // Duração efetiva, não a da tabela de serviços: o histórico precisa
          // registrar o atendimento que aconteceu, com o override do barbeiro.
          serviceDurationMinutesSnapshot: escolhido.durationMinutes,
          startAt: escolhido.start,
          endAt: escolhido.end,
          origin: input.origin,
        })
        .returning();

      return criado;
    });

    return { appointmentId: linha.id, staffId: linha.staffId, startAt: linha.startAt, endAt: linha.endAt };
  } catch (erro) {
    if (isExclusionViolation(erro)) throw new SlotTakenError();
    throw erro;
  }
}
