'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment } from '@/db/schema';
import { verifyManageToken } from '@/lib/tokens';
import { cancelAppointment, CancelNotAllowedError } from '@/domain/booking';
import { notifyOnce, getSender } from '@/notifications';

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
  } catch (erro) {
    // CancelNotAllowedError carrega o motivo exato ("esse horário já começou",
    // "esse atendimento já foi concluído"). Engolir tudo num texto genérico
    // deixaria o cliente sem saber por que o botão não funcionou.
    if (erro instanceof CancelNotAllowedError) return { erro: erro.message };
    console.error('Falha ao cancelar pelo link do cliente', erro);
    return { erro: 'Não foi possível cancelar. Fale com a barbearia.' };
  }

  // `void promessa` morre quando a Vercel congela a função na resposta: o aviso
  // de cancelamento nunca sairia. `after` estende a vida da invocação até o
  // envio terminar.
  after(async () => {
    try {
      await notifyOnce(db, {
        barbershopId: linha.barbershopId,
        appointmentId: verificado.appointmentId,
        type: 'CANCELLATION',
        sender: getSender(),
      });
    } catch (erro) {
      console.error('Falha ao notificar cancelamento', erro);
    }
  });

  revalidatePath(`/agendamento/${token}`);
  return { cancelado: true };
}
