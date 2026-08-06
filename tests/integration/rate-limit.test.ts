import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { checkRateLimit } from '@/lib/rate-limit';

const AGORA = new Date('2026-09-07T12:00:00Z');

describe('checkRateLimit', () => {
  it('libera enquanto está dentro do limite', async () => {
    await withTestDb(async (db) => {
      const args = { key: 'ip:1.2.3.4', limit: 3, windowSeconds: 60, now: AGORA };
      expect((await checkRateLimit(db, args)).allowed).toBe(true);
      expect((await checkRateLimit(db, args)).allowed).toBe(true);
      const terceiro = await checkRateLimit(db, args);
      expect(terceiro.allowed).toBe(true);
      expect(terceiro.remaining).toBe(0);
    });
  });

  it('bloqueia ao passar do limite', async () => {
    await withTestDb(async (db) => {
      const args = { key: 'ip:1.2.3.4', limit: 2, windowSeconds: 60, now: AGORA };
      await checkRateLimit(db, args);
      await checkRateLimit(db, args);
      expect((await checkRateLimit(db, args)).allowed).toBe(false);
    });
  });

  it('conta chaves diferentes separadamente', async () => {
    await withTestDb(async (db) => {
      const base = { limit: 1, windowSeconds: 60, now: AGORA };
      expect((await checkRateLimit(db, { ...base, key: 'ip:1.1.1.1' })).allowed).toBe(true);
      expect((await checkRateLimit(db, { ...base, key: 'ip:2.2.2.2' })).allowed).toBe(true);
    });
  });

  it('libera de novo na janela seguinte', async () => {
    await withTestDb(async (db) => {
      const args = { key: 'ip:1.2.3.4', limit: 1, windowSeconds: 60, now: AGORA };
      await checkRateLimit(db, args);
      expect((await checkRateLimit(db, args)).allowed).toBe(false);
      const depois = new Date(AGORA.getTime() + 61_000);
      expect((await checkRateLimit(db, { ...args, now: depois })).allowed).toBe(true);
    });
  });
});
