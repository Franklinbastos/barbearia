import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { user, session, account, verification, rateLimitBucket, barbershop } from '@/db/schema';

const AGORA = new Date('2026-09-01T12:00:00Z');
const DEPOIS = new Date('2026-09-08T12:00:00Z');

describe('limpeza do banco entre testes', () => {
  it('trunca as tabelas do Better-Auth, o rate limit e as tabelas de negócio', async () => {
    await withTestDb(async (db) => {
      await db.insert(user).values({ id: 'u1', name: 'Dono', email: 'dono@example.com' });
      await db.insert(session).values({
        id: 's1',
        token: 'token-1',
        expiresAt: DEPOIS,
        updatedAt: AGORA,
        userId: 'u1',
      });
      await db.insert(account).values({
        id: 'a1',
        accountId: 'dono@example.com',
        providerId: 'credential',
        userId: 'u1',
        updatedAt: AGORA,
      });
      await db.insert(verification).values({
        id: 'v1',
        identifier: 'dono@example.com',
        value: 'codigo',
        expiresAt: DEPOIS,
      });
      await db.insert(rateLimitBucket).values({ key: 'ip:1.2.3.4', windowStart: AGORA, hits: 3 });
      await db.insert(barbershop).values({ slug: 'sobra', name: 'Sobra' });
    });

    await withTestDb(async (db) => {
      expect(await db.select().from(user)).toHaveLength(0);
      expect(await db.select().from(session)).toHaveLength(0);
      expect(await db.select().from(account)).toHaveLength(0);
      expect(await db.select().from(verification)).toHaveLength(0);
      expect(await db.select().from(rateLimitBucket)).toHaveLength(0);
      expect(await db.select().from(barbershop)).toHaveLength(0);
    });
  });
});
