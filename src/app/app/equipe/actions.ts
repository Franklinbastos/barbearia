'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { staff, workingHours } from '@/db/schema';
import { requireSession } from '@/lib/session';
import { EXPEDIENTE_PADRAO } from '@/domain/onboarding/create-barbershop';

export type StaffFormState = { erro?: string; ok?: boolean };

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do barbeiro'),
});

export async function createStaffAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const sessao = await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  await db.transaction(async (tx) => {
    const [barbeiro] = await tx
      .insert(staff)
      .values({ barbershopId: sessao.barbershopId, name: parsed.data.name, role: 'BARBER' })
      .returning();

    await tx.insert(workingHours).values(
      EXPEDIENTE_PADRAO.map((bloco) => ({ ...bloco, barbershopId: sessao.barbershopId, staffId: barbeiro.id })),
    );
  });

  revalidatePath('/app/equipe');
  return { ok: true };
}

export async function toggleStaffAction(id: string, active: boolean) {
  const sessao = await requireSession();
  await db
    .update(staff)
    .set({ active })
    .where(and(eq(staff.barbershopId, sessao.barbershopId), eq(staff.id, id)));
  revalidatePath('/app/equipe');
}
