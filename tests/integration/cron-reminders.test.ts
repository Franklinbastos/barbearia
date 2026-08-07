import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, customer, appointment, rateLimitBucket } from '@/db/schema';
import { env } from '@/lib/env';

/**
 * O cron é testado com o envio trocado por um dublê: o que está sob teste aqui
 * é o orçamento de tempo da rota — limpeza antes do loop, envio em lotes — e
 * não o conteúdo da mensagem, que tem teste próprio em `notify.test.ts`.
 */
const { notifyOnceMock } = vi.hoisted(() => ({ notifyOnceMock: vi.fn() }));

vi.mock('@/notifications', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/notifications')>();
  return { ...real, notifyOnce: notifyOnceMock };
});

const { GET } = await import('@/app/api/cron/reminders/route');

const DIA_MS = 24 * 60 * 60 * 1000;

function pedido(autorizacao = `Bearer ${env.CRON_SECRET}`) {
  return new Request('http://x/api/cron/reminders', {
    headers: autorizacao ? { authorization: autorizacao } : {},
  });
}

/** Agendamentos daqui a pouco, sem lembrete no log: o cron tem que pegar todos. */
async function semear(db: TestDb, quantos: number) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'cron-teste', name: 'Cron Teste' })
    .returning();
  const [joao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'João', role: 'OWNER' })
    .returning();
  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId: loja.id, name: 'Cliente', phone: '11999998888' })
    .returning();

  const base = Date.now() + 30 * 60_000;
  const linhas = Array.from({ length: quantos }, (_, i) => ({
    barbershopId: loja.id,
    staffId: joao.id,
    customerId: cliente.id,
    serviceNameSnapshot: 'Corte',
    servicePriceCentsSnapshot: 4000,
    serviceDurationMinutesSnapshot: 30,
    startAt: new Date(base + i * 60_000),
    endAt: new Date(base + i * 60_000 + 30_000),
  }));
  await db.insert(appointment).values(linhas);
  return { loja, joao };
}

describe('cron de lembretes', () => {
  beforeEach(() => {
    notifyOnceMock.mockReset();
    notifyOnceMock.mockResolvedValue('SENT');
  });

  it('recusa quem não traz o segredo do cron', async () => {
    await withTestDb(async () => {
      expect((await GET(pedido(''))).status).toBe(401);
      expect((await GET(pedido('Bearer errado'))).status).toBe(401);
      // Segredo de outro tamanho não pode derrubar a rota com exceção.
      expect((await GET(pedido('Bearer x'))).status).toBe(401);
      expect(notifyOnceMock).not.toHaveBeenCalled();
    });
  });

  it('envia os lembretes em lotes paralelos, não um a um', async () => {
    await withTestDb(async (db) => {
      await semear(db, 25);
      let emVoo = 0;
      let pico = 0;
      notifyOnceMock.mockImplementation(async () => {
        emVoo += 1;
        pico = Math.max(pico, emVoo);
        await new Promise((r) => setTimeout(r, 5));
        emVoo -= 1;
        return 'SENT';
      });

      const res = await GET(pedido());

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ enviados: 25 });
      expect(pico).toBeGreaterThan(1);
      // Lote pequeno: mandar os 25 de uma vez estoura o provider.
      expect(pico).toBeLessThanOrEqual(10);
    });
  });

  it('limpa o rate_limit_bucket antes de gastar o tempo com os envios', async () => {
    await withTestDb(async (db) => {
      await semear(db, 3);
      await db.insert(rateLimitBucket).values({
        key: 'velho', windowStart: new Date(Date.now() - 2 * DIA_MS), hits: 9,
      });
      notifyOnceMock.mockRejectedValue(new Error('provider fora do ar'));

      // Loop que estoura é o cenário do achado: a limpeza não pode depender dele.
      await expect(GET(pedido())).rejects.toThrow('provider fora do ar');

      expect(await db.select().from(rateLimitBucket)).toHaveLength(0);
    });
  });

  it('preserva balde do rate limit ainda dentro da janela', async () => {
    await withTestDb(async (db) => {
      await semear(db, 1);
      await db.insert(rateLimitBucket).values({
        key: 'recente', windowStart: new Date(Date.now() - 60_000), hits: 2,
      });

      expect((await GET(pedido())).status).toBe(200);

      expect(await db.select().from(rateLimitBucket)).toHaveLength(1);
    });
  });
});
