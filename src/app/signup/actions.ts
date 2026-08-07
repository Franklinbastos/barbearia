'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { staff } from '@/db/schema';
import { findBarbershopBySlug } from '@/db/repositories';
import { createBarbershopForUser, normalizeSlug } from '@/domain/onboarding/create-barbershop';

/**
 * Mesmo critério do `validateShopSettings`: fuso que o `Intl` não reconhece
 * deixa a grade pública em 404 e a agenda do painel em `Invalid Date`.
 * A regra vive duplicada aqui porque `shop-settings.ts` não exporta o
 * validador — ver a nota no relatório desta frente.
 */
function fusoValido(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  ownerName: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
  shopName: z.string().min(2, 'Informe o nome da barbearia'),
  slug: z.string().min(2, 'Informe o endereço da sua página'),
  timeZone: z.string().refine(fusoValido, 'Fuso horário inválido'),
});

export type SignupState = { erro?: string };

const ERRO_EMAIL_EM_USO = 'Esse e-mail já está em uso. Entre pela tela de acesso ou use outro e-mail.';
const ERRO_BARBEARIA =
  'Sua conta foi criada, mas a barbearia não. Envie este mesmo formulário de novo, com o mesmo e-mail e senha, para concluir.';

/**
 * Detalhe de erro fica no log do servidor. O `/signup` é anônimo: devolver a
 * mensagem crua do driver ou do Better-Auth entrega estrutura de tabela e
 * estado de conta para quem não está autenticado.
 */
function registrar(contexto: string, erro: unknown): void {
  console.error(`[signup] ${contexto}`, erro);
}

/**
 * Conta que existe mas ficou sem barbearia (a criação falhou no meio) precisa
 * de saída: quem provar a senha do e-mail retoma o cadastro de onde parou.
 * Sem isso o dono não entra — o painel exige vínculo — nem se cadastra de novo.
 */
async function retomarContaOrfa(email: string, password: string): Promise<string | null> {
  let userId: string;
  try {
    const entrada = await auth.api.signInEmail({ body: { email, password } });
    userId = entrada.user.id;
  } catch (erro) {
    registrar('senha não confere para e-mail já cadastrado', erro);
    return null;
  }

  const [vinculo] = await db.select().from(staff).where(eq(staff.userId, userId)).limit(1);
  return vinculo ? null : userId;
}

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const dados = parsed.data;

  // O endereço da página é validado ANTES de criar a conta: slug reservado ou
  // já usado deixava um usuário órfão que não entrava nem se recadastrava.
  let slug: string;
  try {
    slug = normalizeSlug(dados.slug);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Endereço de página inválido' };
  }
  if (await findBarbershopBySlug(db, slug)) {
    return { erro: `O endereço "${slug}" já está em uso, escolha outro` };
  }

  let userId: string;
  try {
    const criado = await auth.api.signUpEmail({
      body: { name: dados.ownerName, email: dados.email, password: dados.password },
    });
    userId = criado.user.id;
  } catch (erro) {
    registrar('falha ao criar a conta', erro);
    const retomado = await retomarContaOrfa(dados.email, dados.password);
    if (!retomado) return { erro: ERRO_EMAIL_EM_USO };
    userId = retomado;
  }

  try {
    await createBarbershopForUser(db, {
      userId,
      name: dados.shopName,
      slug,
      timeZone: dados.timeZone,
      ownerName: dados.ownerName,
    });
  } catch (erro) {
    registrar('falha ao criar a barbearia', erro);
    const mensagem = erro instanceof Error ? erro.message : '';
    if (/unique|duplicate/i.test(mensagem)) {
      return { erro: `O endereço "${slug}" já está em uso, escolha outro` };
    }
    return { erro: ERRO_BARBEARIA };
  }

  redirect('/app');
}
