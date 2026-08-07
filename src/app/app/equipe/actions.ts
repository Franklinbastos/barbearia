'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { staff, workingHours } from '@/db/schema';
import { requireOwner } from '@/lib/session';
import { EXPEDIENTE_PADRAO } from '@/domain/onboarding/create-barbershop';

export type StaffFormState = { erro?: string; ok?: boolean };

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do barbeiro'),
});

export async function createStaffAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const acesso = await requireOwner();
  if (!acesso.ok) return { erro: acesso.erro };
  const sessao = acesso.sessao;

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

/**
 * O botão de ativar/desativar não tem formulário, então a falha volta pela URL
 * da própria lista — é o que a página exibe em `?erro=`.
 *
 * Vai só o código, nunca o texto: a URL é editável por qualquer um, e mensagem
 * livre na querystring deixaria escrever o que se quisesse dentro do painel
 * autenticado. Quem traduz código em frase é `MENSAGENS_DE_ERRO` na página.
 */
export type CodigoErroEquipe =
  | 'SEM_PERMISSAO'
  | 'MEMBRO_INEXISTENTE'
  | 'ULTIMO_DONO'
  | 'NAO_PODE_DESATIVAR_A_SI';

function recusar(codigo: CodigoErroEquipe): never {
  redirect(`/app/equipe?erro=${codigo}`);
}

export async function toggleStaffAction(id: string, active: boolean) {
  const acesso = await requireOwner();
  if (!acesso.ok) recusar('SEM_PERMISSAO');
  const sessao = acesso.sessao;

  if (!active) {
    const [alvo] = await db
      .select()
      .from(staff)
      .where(and(eq(staff.barbershopId, sessao.barbershopId), eq(staff.id, id)))
      .limit(1);

    if (!alvo) recusar('MEMBRO_INEXISTENTE');

    if (alvo.role === 'OWNER') {
      const [{ total }] = await db
        .select({ total: count() })
        .from(staff)
        .where(
          and(
            eq(staff.barbershopId, sessao.barbershopId),
            eq(staff.role, 'OWNER'),
            eq(staff.active, true),
          ),
        );
      // Sem esta guarda um clique tranca todo mundo fora do painel: sessão
      // exige vínculo ativo e o cadastro recusa o e-mail que já existe.
      if (total <= 1) recusar('ULTIMO_DONO');
    }

    if (id === sessao.staffId) {
      recusar('NAO_PODE_DESATIVAR_A_SI');
    }
  }

  await db
    .update(staff)
    .set({ active })
    .where(and(eq(staff.barbershopId, sessao.barbershopId), eq(staff.id, id)));
  revalidatePath('/app/equipe');
}
