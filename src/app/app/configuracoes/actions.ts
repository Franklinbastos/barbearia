'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { barbershop } from '@/db/schema';
import { requireOwner } from '@/lib/session';
import { validateShopSettings } from '@/domain/catalog/shop-settings';

export type SettingsState = { erro?: string; ok?: boolean };

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const acesso = await requireOwner();
  if (!acesso.ok) return { erro: acesso.erro };
  const sessao = acesso.sessao;

  let dados;
  try {
    dados = validateShopSettings(Object.fromEntries(formData));
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Dados inválidos' };
  }

  await db.update(barbershop).set(dados).where(eq(barbershop.id, sessao.barbershopId));
  revalidatePath('/app/configuracoes');
  return { ok: true };
}
