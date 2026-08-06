'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment } from '@/db/schema';
import { requireSession } from '@/lib/session';
import { cancelAppointment, createAppointment } from '@/domain/booking';

export async function setAppointmentStatusAction(
  appointmentId: string,
  status: 'DONE' | 'NO_SHOW' | 'CANCELED',
) {
  const sessao = await requireSession();

  if (status === 'CANCELED') {
    await cancelAppointment(db, sessao.barbershopId, appointmentId);
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

export async function createManualAppointmentAction(
  _prev: ManualBookingState,
  formData: FormData,
): Promise<ManualBookingState> {
  const sessao = await requireSession();

  try {
    await createAppointment(db, {
      barbershopId: sessao.barbershopId,
      serviceId: String(formData.get('serviceId')),
      staffId: String(formData.get('staffId')),
      startAt: new Date(String(formData.get('startAt'))),
      customer: {
        name: String(formData.get('name')),
        phone: String(formData.get('phone')).replace(/\D/g, ''),
      },
      origin: 'PANEL',
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Não foi possível agendar' };
  }

  revalidatePath('/app/agenda');
  return { ok: true };
}
