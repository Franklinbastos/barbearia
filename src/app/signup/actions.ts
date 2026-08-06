'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { createBarbershopForUser } from '@/domain/onboarding/create-barbershop';

const schema = z.object({
  ownerName: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
  shopName: z.string().min(2, 'Informe o nome da barbearia'),
  slug: z.string().min(2, 'Informe o endereço da sua página'),
  timeZone: z.string().min(3),
});

export type SignupState = { erro?: string };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const dados = parsed.data;

  try {
    const criado = await auth.api.signUpEmail({
      body: { name: dados.ownerName, email: dados.email, password: dados.password },
    });
    await createBarbershopForUser(db, {
      userId: criado.user.id,
      name: dados.shopName,
      slug: dados.slug,
      timeZone: dados.timeZone,
      ownerName: dados.ownerName,
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido';
    if (/unique|duplicate/i.test(mensagem)) return { erro: 'Esse e-mail ou endereço de página já está em uso' };
    return { erro: mensagem };
  }

  redirect('/app');
}
