'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { service } from '@/db/schema';
import { requireOwner } from '@/lib/session';
import { findBarbershopById } from '@/db/repositories';
import { validateServiceInput } from '@/domain/catalog/service-rules';

export type ServiceFormState = { erro?: string; ok?: boolean };

export async function saveServiceAction(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const acesso = await requireOwner();
  if (!acesso.ok) return { erro: acesso.erro };
  const sessao = acesso.sessao;

  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return { erro: 'Barbearia não encontrada' };

  let dados;
  try {
    dados = validateServiceInput(Object.fromEntries(formData), loja.slotMinutes);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Dados inválidos' };
  }

  const id = formData.get('id');
  if (typeof id === 'string' && id) {
    await db
      .update(service)
      .set(dados)
      .where(and(eq(service.barbershopId, sessao.barbershopId), eq(service.id, id)));
  } else {
    await db.insert(service).values({ ...dados, barbershopId: sessao.barbershopId });
  }

  revalidatePath('/app/servicos');
  return { ok: true };
}

export async function toggleServiceAction(
  id: string,
  active: boolean,
): Promise<ServiceFormState | undefined> {
  const acesso = await requireOwner();
  if (!acesso.ok) return { erro: acesso.erro };

  await db
    .update(service)
    .set({ active })
    .where(and(eq(service.barbershopId, acesso.sessao.barbershopId), eq(service.id, id)));
  revalidatePath('/app/servicos');
}
