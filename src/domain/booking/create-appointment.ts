import { DateTime } from 'luxon';
import { appointment } from '@/db/schema';
import { findBarbershopById, findServiceById, upsertCustomer, type Db } from '@/db/repositories';
import { getAvailability } from './availability-service';
import { NotFoundError, SlotTakenError, SlotUnavailableError, isExclusionViolation } from './errors';

export type CreateAppointmentInput = {
  barbershopId: string;
  serviceId: string;
  staffId?: string;
  startAt: Date;
  customer: { name: string; phone: string };
  origin: 'PUBLIC' | 'PANEL' | 'BOT';
  now?: Date;
};

export async function createAppointment(db: Db, input: CreateAppointmentInput) {
  const loja = await findBarbershopById(db, input.barbershopId);
  if (!loja) throw new NotFoundError('Barbearia não encontrada');

  const servico = await findServiceById(db, input.barbershopId, input.serviceId);
  if (!servico || !servico.active) throw new NotFoundError('Serviço não encontrado');

  const date = DateTime.fromJSDate(input.startAt).setZone(loja.timeZone).toISODate()!;

  // Recalcula sempre: o horário que o navegador mostrou é sugestão, não reserva.
  const disponiveis = await getAvailability(db, {
    barbershopId: input.barbershopId,
    serviceId: input.serviceId,
    staffId: input.staffId,
    date,
    now: input.now,
  });

  const candidatos = disponiveis.filter((s) => s.start.getTime() === input.startAt.getTime());
  if (candidatos.length === 0) throw new SlotUnavailableError();

  const escolhido = candidatos[0];
  const cliente = await upsertCustomer(db, input.barbershopId, input.customer);

  try {
    const [linha] = await db
      .insert(appointment)
      .values({
        barbershopId: input.barbershopId,
        staffId: escolhido.staffId,
        customerId: cliente.id,
        serviceId: servico.id,
        serviceNameSnapshot: servico.name,
        servicePriceCentsSnapshot: servico.priceCents,
        serviceDurationMinutesSnapshot: servico.durationMinutes,
        startAt: escolhido.start,
        endAt: escolhido.end,
        origin: input.origin,
      })
      .returning();

    return { appointmentId: linha.id, staffId: linha.staffId, startAt: linha.startAt, endAt: linha.endAt };
  } catch (erro) {
    if (isExclusionViolation(erro)) throw new SlotTakenError();
    throw erro;
  }
}
