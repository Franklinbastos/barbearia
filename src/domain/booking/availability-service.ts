import { DateTime } from 'luxon';
import { computeAvailability, parseTimeToMinutes, type Slot } from '@/domain/availability';
import {
  findBarbershopById, findServiceById, listStaffForService, listWorkingHours, listBusyRanges,
  type Db,
} from '@/db/repositories';
import { NotFoundError } from './errors';

export type AvailabilitySlot = { staffId: string; staffName: string; start: Date; end: Date };

export async function getAvailability(
  db: Db,
  params: { barbershopId: string; serviceId: string; staffId?: string; date: string; now?: Date },
): Promise<AvailabilitySlot[]> {
  const loja = await findBarbershopById(db, params.barbershopId);
  if (!loja) throw new NotFoundError('Barbearia não encontrada');

  const servico = await findServiceById(db, params.barbershopId, params.serviceId);
  if (!servico || !servico.active) throw new NotFoundError('Serviço não encontrado');

  const candidatos = await listStaffForService(db, params.barbershopId, params.serviceId);
  const equipe = params.staffId ? candidatos.filter((c) => c.id === params.staffId) : candidatos;
  if (equipe.length === 0) return [];

  const dia = DateTime.fromISO(params.date, { zone: loja.timeZone });
  if (!dia.isValid) throw new NotFoundError('Data inválida');
  const inicioDia = dia.startOf('day').toJSDate();
  const fimDia = dia.plus({ days: 1 }).startOf('day').toJSDate();
  const agora = params.now ?? new Date();

  const resultado: AvailabilitySlot[] = [];

  for (const barbeiro of equipe) {
    const expediente = await listWorkingHours(db, params.barbershopId, barbeiro.id, dia.weekday);
    if (expediente.length === 0) continue;

    const ocupados = await listBusyRanges(db, params.barbershopId, barbeiro.id, inicioDia, fimDia);

    const slots: Slot[] = computeAvailability({
      date: params.date,
      timeZone: loja.timeZone,
      slotMinutes: loja.slotMinutes,
      minLeadMinutes: loja.minLeadMinutes,
      serviceDurationMinutes: Number(barbeiro.effectiveDurationMinutes),
      workingBlocks: expediente.map((b) => ({
        startMinute: parseTimeToMinutes(b.startTime),
        endMinute: parseTimeToMinutes(b.endTime),
      })),
      busy: ocupados,
      now: agora,
    });

    for (const slot of slots) {
      resultado.push({ staffId: barbeiro.id, staffName: barbeiro.name, start: slot.start, end: slot.end });
    }
  }

  return resultado.sort((a, b) => a.start.getTime() - b.start.getTime());
}
