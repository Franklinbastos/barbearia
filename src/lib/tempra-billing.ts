import { z } from 'zod';

import { env } from '@/lib/env';

const PRODUTO = 'barbearia';

const planoSchema = z.object({
  code: z.string(),
  product: z.string(),
  name: z.string(),
  monthlyPriceCents: z.number().int().nonnegative(),
  includedCredits: z.record(z.string(), z.number().int().nonnegative()),
  usagePolicy: z.object({
    messagesPerCredit: z.number().int().positive().nullable().optional(),
    inputTokensPerCredit: z.number().int().positive().nullable().optional(),
    outputTokensPerCredit: z.number().int().positive().nullable().optional(),
  }).optional(),
  entitlements: z.array(z.string()),
  active: z.boolean(),
});

const pacoteSchema = z.object({
  code: z.string(),
  product: z.string(),
  name: z.string(),
  priceCents: z.number().int().nonnegative(),
  unit: z.string(),
  quantity: z.number().int().positive(),
  active: z.boolean(),
});

const assinaturaSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  customerId: z.string(),
  product: z.string(),
  planCode: z.string(),
  status: z.enum(['trialing', 'active', 'past_due', 'canceled', 'expired']),
  currentPeriodStart: z.iso.datetime({ offset: true }),
  currentPeriodEnd: z.iso.datetime({ offset: true }),
});

const checkoutSchema = z.object({
  id: z.uuid(),
  provider: z.string(),
  tenantId: z.string(),
  customerId: z.string(),
  product: z.string(),
  kind: z.enum(['subscription', 'credit_pack']),
  offerCode: z.string(),
  amount: z.object({ currency: z.string(), amountCents: z.number().int().nonnegative() }),
  status: z.enum([
    'creating',
    'active',
    'paid',
    'past_due',
    'refunded',
    'chargeback',
    'canceled',
    'expired',
    'failed',
    'unknown',
  ]),
  checkoutUrl: z.url().optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  fulfilledAt: z.iso.datetime({ offset: true }).optional(),
  errorCode: z.string().optional(),
});

const catalogoSchema = z.object({
  data: z.object({
    product: z.string(),
    plans: z.array(planoSchema),
    creditPackages: z.array(pacoteSchema),
  }),
});
const assinaturaRespostaSchema = z.object({ data: assinaturaSchema.nullable() });
const saldoRespostaSchema = z.object({ balance: z.number().int().nonnegative() });
const ledgerEntrySchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  product: z.string(),
  unit: z.string(),
  kind: z.enum(['grant', 'debit', 'refund', 'adjustment', 'expiration']),
  amount: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
  occurredAt: z.iso.datetime({ offset: true }),
  idempotencyKey: z.string(),
  reason: z.string().optional(),
  grantSource: z.string().optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});
const ledgerRespostaSchema = z.object({ data: z.array(ledgerEntrySchema) });
const checkoutRespostaSchema = z.object({ data: checkoutSchema });
const criarCheckoutRespostaSchema = z.object({ data: checkoutSchema, replayed: z.boolean() });
const erroRespostaSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type PlanoBilling = z.infer<typeof planoSchema>;
export type PacoteBilling = z.infer<typeof pacoteSchema>;
export type AssinaturaBilling = z.infer<typeof assinaturaSchema>;
export type CheckoutBilling = z.infer<typeof checkoutSchema>;
export type EntradaLedgerBilling = z.infer<typeof ledgerEntrySchema>;

export type NovoCheckout = {
  tenantId: string;
  customerId: string;
  offerCode: string;
  kind?: 'subscription' | 'credit_pack';
  idempotencyKey: string;
  payer: {
    name: string;
    taxId: string;
    email: string;
    phone: string;
    address?: string;
    addressNumber: string;
    complement?: string;
    province?: string;
    postalCode: string;
  };
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
};

export class TempraBillingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TempraBillingError';
  }
}

export type ConfiguracaoTempraBilling = {
  url: string;
  apiKey: string;
};

export function billingEstaAtivo(): boolean {
  return env.TEMPRA_BILLING_ENABLED === 'true';
}

export function criarClienteTempraBilling(
  configuracao: ConfiguracaoTempraBilling,
  fetcher: typeof fetch = fetch,
) {
  async function requisitar<T>(
    caminho: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
  ): Promise<T> {
    let resposta: Response;
    try {
      resposta = await fetcher(new URL(caminho, configuracao.url), {
        ...init,
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
        headers: {
          authorization: `Bearer ${configuracao.apiKey}`,
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new TempraBillingError(
        'O serviço de cobrança não respondeu.',
        'billing_unavailable',
        503,
      );
    }

    const corpo: unknown = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      const erro = erroRespostaSchema.safeParse(corpo);
      throw new TempraBillingError(
        erro.success ? erro.data.error.message : 'O serviço de cobrança recusou a operação.',
        erro.success ? erro.data.error.code : 'billing_request_failed',
        resposta.status,
      );
    }

    const validado = schema.safeParse(corpo);
    if (!validado.success) {
      throw new TempraBillingError(
        'O serviço de cobrança devolveu uma resposta inválida.',
        'billing_invalid_response',
        502,
      );
    }
    return validado.data;
  }

  return {
    async buscarCatalogo() {
      return (await requisitar(`/v1/catalog/${PRODUTO}`, catalogoSchema)).data;
    },
    async buscarAssinatura(tenantId: string) {
      const caminho = `/v1/tenants/${encodeURIComponent(tenantId)}/products/${PRODUTO}/subscription`;
      return (await requisitar(caminho, assinaturaRespostaSchema)).data;
    },
    async buscarSaldo(tenantId: string, unidade = 'whatsapp_message') {
      const caminho = `/v1/tenants/${encodeURIComponent(tenantId)}/products/${PRODUTO}/credits/${encodeURIComponent(unidade)}`;
      return (await requisitar(caminho, saldoRespostaSchema)).balance;
    },
    async buscarLedger(tenantId: string, limite = 20, unidade = 'whatsapp_message') {
      const caminho = `/v1/tenants/${encodeURIComponent(tenantId)}/products/${PRODUTO}/credits/${encodeURIComponent(unidade)}/ledger?limit=${limite}`;
      return (await requisitar(caminho, ledgerRespostaSchema)).data;
    },
    async criarCheckout(input: NovoCheckout) {
      const kind = input.kind ?? 'subscription';
      const resposta = await requisitar('/v1/checkouts', criarCheckoutRespostaSchema, {
        method: 'POST',
        headers: { 'idempotency-key': input.idempotencyKey },
        body: JSON.stringify({
          tenantId: input.tenantId,
          customerId: input.customerId,
          product: PRODUTO,
          kind,
          offerCode: input.offerCode,
          paymentMethods: kind === 'subscription' ? ['credit_card'] : ['credit_card', 'pix'],
          payer: input.payer,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          expiredUrl: input.expiredUrl,
        }),
      });
      return resposta.data;
    },
    async buscarCheckout(checkoutId: string) {
      return (
        await requisitar(
          `/v1/checkouts/${encodeURIComponent(checkoutId)}`,
          checkoutRespostaSchema,
        )
      ).data;
    },
  };
}

export function clienteTempraBilling() {
  if (!billingEstaAtivo() || !env.TEMPRA_BILLING_URL || !env.TEMPRA_BILLING_API_KEY) {
    throw new TempraBillingError(
      'A cobrança não está configurada neste ambiente.',
      'billing_disabled',
      503,
    );
  }
  return criarClienteTempraBilling({
    url: env.TEMPRA_BILLING_URL,
    apiKey: env.TEMPRA_BILLING_API_KEY,
  });
}
