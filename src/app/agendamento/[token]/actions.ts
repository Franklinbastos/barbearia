'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment } from '@/db/schema';
import { verifyManageToken } from '@/lib/tokens';
import { cancelAppointment } from '@/domain/booking';

export type CancelState = { erro?: string; cancelado?: boolean };

export async function cancelByTokenAction(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const token = String(formData.get('token') ?? '');
  const verificado = verifyManageToken(token);
  if (!verificado) return { erro: 'Este link não é mais válido' };

  const [linha] = await db
    .select({ barbershopId: appointment.barbershopId })
    .from(appointment)
    .where(eq(appointment.id, verificado.appointmentId))
    .limit(1);
  if (!linha) return { erro: 'Agendamento não encontrado' };

  try {
    await cancelAppointment(db, linha.barbershopId, verificado.appointmentId);
  } catch {
    return { erro: 'Não foi possível cancelar. Fale com a barbearia.' };
  }

  revalidatePath(`/agendamento/${token}`);
  return { cancelado: true };
}
