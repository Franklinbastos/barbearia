'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment } from '@/db/schema';
import { findBarbershopById } from '@/db/repositories';
import { requireSession } from '@/lib/session';
import { cancelAppointment, createWalkInAppointment } from '@/domain/booking';
import { resolverInicioDoEncaixe } from './encaixe';

export async function setAppointmentStatusAction(
  appointmentId: string,
  status: 'DONE' | 'NO_SHOW' | 'CANCELED',
) {
  const sessao = await requireSession();

  if (status === 'CANCELED') {
    // origin PANEL: a barbearia logada pode fechar atendimento que já começou ou
    // que já passou. O padrão de cancelAppointment é o caminho restrito do cliente.
    await cancelAppointment(db, sessao.barbershopId, appointmentId, { origin: 'PANEL' });
  } else {
    await db
      .update(appointment)
      .set({ status })
      .where(
        and(eq(appointment.barbershopId, sessao.barbershopId), eq(appointment.id, appointmentId)),
      );
  }

  revalidatePath('/app/agenda');
}

export type ManualBookingState = { erro?: string; ok?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}

export async function createManualAppointmentAction(
  _prev: ManualBookingState,
  formData: FormData,
): Promise<ManualBookingState> {
  // Encaixe é operação de balcão: o BARBER também encaixa, não só o OWNER.
  const sessao = await requireSession();

  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return { erro: 'Barbearia não encontrada.' };

  const serviceId = texto(formData, 'serviceId');
  const staffId = texto(formData, 'staffId');
  if (!UUID.test(serviceId)) return { erro: 'Escolha um serviço.' };
  if (!UUID.test(staffId)) return { erro: 'Escolha um barbeiro.' };

  const startAt = resolverInicioDoEncaixe({
    startAt: texto(formData, 'startAt'),
    date: texto(formData, 'date'),
    hora: texto(formData, 'horaLivre'),
    timeZone: loja.timeZone,
  });
  if (!startAt) return { erro: 'Informe um horário válido para o encaixe.' };

  const name = texto(formData, 'name');
  if (name.length < 2 || name.length > 80) return { erro: 'Informe o nome do cliente.' };

  const phone = texto(formData, 'phone').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 13) return { erro: 'Informe um telefone com DDD.' };

  try {
    // Caminho próprio do balcão: fora da grade, sem antecedência mínima e sem
    // janela máxima — quem está com o cliente na cadeira sabe o que faz.
    await createWalkInAppointment(db, {
      barbershopId: sessao.barbershopId,
      serviceId,
      staffId,
      startAt,
      customer: { name, phone },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Não foi possível agendar' };
  }

  revalidatePath('/app/agenda');
  return { ok: true };
}
