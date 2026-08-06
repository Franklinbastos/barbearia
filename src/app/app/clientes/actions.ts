'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { customer } from '@/db/schema';
import { anonymizeCustomer } from '@/domain/privacy/anonymize-customer';

export type AnonymizeState = { erro?: string; ok?: boolean };

export async function anonymizeCustomerAction(
  customerId: string,
  _prev: AnonymizeState,
): Promise<AnonymizeState> {
  const sessao = await requireSession();
  if (sessao.role !== 'OWNER') return { erro: 'Só o dono pode remover dados de cliente' };

  try {
    await anonymizeCustomer(db, sessao.barbershopId, customerId);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Não foi possível remover os dados' };
  }

  revalidatePath(`/app/clientes/${customerId}`);
  revalidatePath('/app/clientes');
  return { ok: true };
}

export type NotesState = { erro?: string; ok?: boolean };

export async function saveCustomerNotesAction(
  customerId: string,
  _prev: NotesState,
  formData: FormData,
): Promise<NotesState> {
  const sessao = await requireSession();
  const notes = String(formData.get('notes') ?? '').trim() || null;

  await db
    .update(customer)
    .set({ notes })
    .where(and(eq(customer.barbershopId, sessao.barbershopId), eq(customer.id, customerId)));

  revalidatePath(`/app/clientes/${customerId}`);
  return { ok: true };
}
