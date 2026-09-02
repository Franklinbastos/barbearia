'use server';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/db/client';
import { user } from '@/db/schema';
import { env } from '@/lib/env';
import { clienteTempraBilling, TempraBillingError } from '@/lib/tempra-billing';
import { requireOwner } from '@/lib/session';
import { COOKIE_DO_CHECKOUT } from './checkout-cookie';

export type CheckoutState = { erro?: string };

const textoOpcional = (maximo: number) =>
  z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    z.string().trim().min(2).max(maximo).optional(),
  );

const checkoutSchema = z.object({
  planCode: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  creditPackCode: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  kind: z.enum(['subscription', 'credit_pack']).optional(),
  checkoutNonce: z.uuid(),
  payerName: z.string().trim().min(2).max(120),
  taxId: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ''))
    .refine((valor) => valor.length === 11 || valor.length === 14),
  phone: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ''))
    .refine((valor) => valor.length === 10 || valor.length === 11),
  postalCode: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ''))
    .refine((valor) => valor.length === 8),
  address: textoOpcional(120),
  addressNumber: z.string().trim().min(1).max(20),
  complement: textoOpcional(255),
  province: textoOpcional(120),
}).superRefine((valor, ctx) => {
  const tipo = valor.creditPackCode ? 'credit_pack' : (valor.kind ?? 'subscription');
  const codigo = tipo === 'subscription' ? valor.planCode : valor.creditPackCode;
  if (!codigo) {
    ctx.addIssue({ code: 'custom', path: [tipo === 'subscription' ? 'planCode' : 'creditPackCode'], message: 'Selecione uma oferta.' });
  }
});

export async function iniciarAssinaturaAction(
  _estado: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const acesso = await requireOwner();
  if (!acesso.ok) return { erro: acesso.erro };

  const validado = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!validado.success) {
    return { erro: 'Confira CPF ou CNPJ, telefone, CEP e endereço de cobrança.' };
  }

  const [dono] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, acesso.sessao.userId))
    .limit(1);
  if (!dono) return { erro: 'Não foi possível identificar o responsável pela conta.' };

  const retorno = (resultado: 'sucesso' | 'cancelado' | 'expirado') => {
    const url = new URL(
      env.TEMPRA_BILLING_RETURN_URL
        ? '/api/tempra-billing/return'
        : '/app/assinatura/retorno',
      env.TEMPRA_BILLING_RETURN_URL ?? env.APP_URL,
    );
    url.searchParams.set('resultado', resultado);
    return url.toString();
  };

  const kind = validado.data.creditPackCode ? 'credit_pack' : (validado.data.kind ?? 'subscription');
  const offerCode = kind === 'subscription'
    ? validado.data.planCode
    : validado.data.creditPackCode;
  if (!offerCode) return { erro: 'Selecione uma oferta para continuar.' };

  let checkout;
  try {
    checkout = await clienteTempraBilling().criarCheckout({
      tenantId: acesso.sessao.barbershopId,
      customerId: acesso.sessao.userId,
      kind,
      offerCode,
      idempotencyKey: `barbearia:${acesso.sessao.barbershopId}:${kind}:${offerCode}:${validado.data.checkoutNonce}`,
      payer: {
        name: validado.data.payerName,
        taxId: validado.data.taxId,
        email: dono.email,
        phone: validado.data.phone,
        address: validado.data.address,
        addressNumber: validado.data.addressNumber,
        complement: validado.data.complement,
        province: validado.data.province,
        postalCode: validado.data.postalCode,
      },
      successUrl: retorno('sucesso'),
      cancelUrl: retorno('cancelado'),
      expiredUrl: retorno('expirado'),
    });
  } catch (erro) {
    if (erro instanceof TempraBillingError && erro.status >= 500) {
      return { erro: 'A cobrança está temporariamente indisponível. Tente novamente em instantes.' };
    }
    return { erro: 'Não foi possível abrir o pagamento. Confira os dados de cobrança.' };
  }

  if (!checkout.checkoutUrl) {
    return { erro: 'O provedor não devolveu um endereço de pagamento.' };
  }

  (await cookies()).set(COOKIE_DO_CHECKOUT, checkout.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(env.APP_URL).protocol === 'https:',
    maxAge: 60 * 60 * 48,
    path: '/app/assinatura',
  });
  redirect(checkout.checkoutUrl);
}
