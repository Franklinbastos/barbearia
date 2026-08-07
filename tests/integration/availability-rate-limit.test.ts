import { describe, it, expect, afterAll } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, rateLimitBucket } from '@/db/schema';
import { closeDb } from '@/db/client';
import { clientKey } from '@/lib/rate-limit';
import { GET } from '@/app/api/public/[slug]/availability/route';

const IP = '203.0.113.9';
const SERVICO = '11111111-1111-4111-8111-111111111111';
const DIA = '2026-09-10';

afterAll(async () => {
  await closeDb();
});

function chamar(slug: string) {
  const url = `http://localhost/api/public/${slug}/availability?serviceId=${SERVICO}&date=${DIA}`;
  const req = new Request(url, { headers: { 'x-forwarded-for': IP } });
  return GET(req, { params: Promise.resolve({ slug }) });
}

describe('rate limit da disponibilidade — achado 13', () => {
  it('slug inventado devolve 404 e não cria chave nenhuma no balde', async () => {
    await withTestDb(async (db) => {
      for (let i = 0; i < 25; i++) {
        const res = await chamar(`nao-existe-${i}-${Math.random().toString(36).slice(2)}`);
        expect(res.status).toBe(404);
      }

      const baldes = await db.select().from(rateLimitBucket);
      expect(baldes, 'cada slug aleatório virou uma chave nova e a tabela cresceu sem teto').toHaveLength(0);
    });
  });

  it('conta pelo id da barbearia, não pelo slug cru', async () => {
    await withTestDb(async (db) => {
      const [loja] = await db
        .insert(barbershop)
        .values({ slug: 'toca-b', name: 'Toca' })
        .returning();

      await chamar('toca-b');
      await chamar('toca-b');
      await chamar('toca-b');

      const baldes = await db.select().from(rateLimitBucket);
      expect(baldes).toHaveLength(1);
      expect(baldes[0].hits).toBe(3);
      expect(baldes[0].key).toContain(loja.id);
      expect(baldes[0].key).not.toContain('toca-b');
    });
  });

  it('a chave gravada tem tamanho limitado', async () => {
    await withTestDb(async (db) => {
      await db.insert(barbershop).values({ slug: 'toca-b', name: 'Toca' });

      const url = `http://localhost/api/public/toca-b/availability?serviceId=${SERVICO}&date=${DIA}`;
      const req = new Request(url, { headers: { 'x-forwarded-for': 'x'.repeat(5000) } });
      await GET(req, { params: Promise.resolve({ slug: 'toca-b' }) });

      const [balde] = await db.select().from(rateLimitBucket);
      expect(balde.key.length).toBeLessThanOrEqual(160);
    });
  });

  it('parâmetro inválido nem chega a contar', async () => {
    await withTestDb(async (db) => {
      await db.insert(barbershop).values({ slug: 'toca-b', name: 'Toca' });

      const req = new Request('http://localhost/api/public/toca-b/availability?date=abc', {
        headers: { 'x-forwarded-for': IP },
      });
      const res = await GET(req, { params: Promise.resolve({ slug: 'toca-b' }) });

      expect(res.status).toBe(400);
      expect(await db.select().from(rateLimitBucket)).toHaveLength(0);
    });
  });
});

describe('clientKey', () => {
  it('corta o que vem do cliente para a chave não crescer sem limite', () => {
    const req = new Request('http://localhost/x', {
      headers: { 'x-forwarded-for': 'a'.repeat(9000) },
    });
    expect(clientKey(req, 'b'.repeat(9000)).length).toBeLessThanOrEqual(160);
  });

  it('mantém a separação entre IPs diferentes', () => {
    const um = new Request('http://localhost/x', { headers: { 'x-forwarded-for': '1.1.1.1' } });
    const dois = new Request('http://localhost/x', { headers: { 'x-forwarded-for': '2.2.2.2' } });
    expect(clientKey(um, 'avail')).not.toBe(clientKey(dois, 'avail'));
  });
});
