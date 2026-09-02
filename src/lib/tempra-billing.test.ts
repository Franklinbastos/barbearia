import { describe, expect, it, vi } from 'vitest';

import { criarClienteTempraBilling, TempraBillingError } from './tempra-billing';

const configuracao = {
  url: 'http://billing.test:3333',
  apiKey: 'segredo-do-billing-com-mais-de-32-caracteres',
};

describe('cliente Tempra Billing', () => {
  it('autentica a consulta de catálogo sem usar cache', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({
        data: {
          product: 'barbearia',
          plans: [],
          creditPackages: [],
        },
      }),
    );
    const cliente = criarClienteTempraBilling(configuracao, fetcher as typeof fetch);

    await expect(cliente.buscarCatalogo()).resolves.toMatchObject({ product: 'barbearia' });
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://billing.test:3333/v1/catalog/barbearia'),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({ authorization: `Bearer ${configuracao.apiKey}` }),
      }),
    );
  });

  it('consulta saldo na unidade informada pelo catalogo', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({ balance: 12 }),
    );
    const cliente = criarClienteTempraBilling(configuracao, fetcher as typeof fetch);

    await expect(cliente.buscarSaldo('tenant-1', 'agent_action')).resolves.toBe(12);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://billing.test:3333/v1/tenants/tenant-1/products/barbearia/credits/agent_action'),
      expect.anything(),
    );
  });

  it('envia checkout recorrente com idempotência', async () => {
    const checkout = {
      id: '4ebc3c6a-6fd6-483f-9f7f-c58a8d633856',
      provider: 'asaas',
      tenantId: 'tenant-1',
      customerId: 'owner-1',
      product: 'barbearia',
      kind: 'subscription',
      offerCode: 'essencial',
      amount: { currency: 'BRL', amountCents: 2_990 },
      status: 'active',
      checkoutUrl: 'https://sandbox.asaas.com/checkout/test',
    };
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({ data: checkout, replayed: false }),
    );
    const cliente = criarClienteTempraBilling(configuracao, fetcher as typeof fetch);

    await cliente.criarCheckout({
      tenantId: 'tenant-1',
      customerId: 'owner-1',
      offerCode: 'essencial',
      idempotencyKey: 'checkout:tenant-1:nonce',
      payer: {
        name: 'Maria Silva',
        taxId: '12345678901',
        email: 'maria@example.com',
        phone: '51999999999',
        addressNumber: '10',
        postalCode: '90000000',
      },
      successUrl: 'http://barbearia.test/app/assinatura/retorno?resultado=sucesso',
      cancelUrl: 'http://barbearia.test/app/assinatura/retorno?resultado=cancelado',
      expiredUrl: 'http://barbearia.test/app/assinatura/retorno?resultado=expirado',
    });

    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ 'idempotency-key': 'checkout:tenant-1:nonce' });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      kind: 'subscription',
      paymentMethods: ['credit_card'],
      product: 'barbearia',
    });
  });

  it('envia pacote avulso com cartao e Pix', async () => {
    const checkout = {
      id: '4ebc3c6a-6fd6-483f-9f7f-c58a8d633856',
      provider: 'asaas',
      tenantId: 'tenant-1',
      customerId: 'owner-1',
      product: 'barbearia',
      kind: 'credit_pack',
      offerCode: 'pacote-100',
      amount: { currency: 'BRL', amountCents: 1_990 },
      status: 'active',
      checkoutUrl: 'https://sandbox.asaas.com/checkout/test',
    };
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({ data: checkout, replayed: false }),
    );
    const cliente = criarClienteTempraBilling(configuracao, fetcher as typeof fetch);

    await cliente.criarCheckout({
      tenantId: 'tenant-1',
      customerId: 'owner-1',
      kind: 'credit_pack',
      offerCode: 'pacote-100',
      idempotencyKey: 'checkout:tenant-1:credit_pack:nonce',
      payer: {
        name: 'Maria Silva', taxId: '12345678901', email: 'maria@example.com',
        phone: '51999999999', addressNumber: '10', postalCode: '90000000',
      },
      successUrl: 'http://barbearia.test/app/assinatura/retorno?resultado=sucesso',
      cancelUrl: 'http://barbearia.test/app/assinatura/retorno?resultado=cancelado',
      expiredUrl: 'http://barbearia.test/app/assinatura/retorno?resultado=expirado',
    });

    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ 'idempotency-key': 'checkout:tenant-1:credit_pack:nonce' });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      kind: 'credit_pack',
      offerCode: 'pacote-100',
      paymentMethods: ['credit_card', 'pix'],
    });
  });

  it('converte falha de rede em erro estável', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
      throw new Error('socket hang up');
    });
    const cliente = criarClienteTempraBilling(configuracao, fetcher as typeof fetch);

    await expect(cliente.buscarCatalogo()).rejects.toEqual(
      expect.objectContaining<Partial<TempraBillingError>>({
        code: 'billing_unavailable',
        status: 503,
      }),
    );
  });
});
