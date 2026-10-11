import { describe, it, expect, afterAll } from 'vitest';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, timeOff, workingHours } from '@/db/schema';
import { closeDb } from '@/db/client';
import { listTimeOffBetween, listWorkingHoursForBarbershop } from '@/db/repositories';

afterAll(async () => {
  await closeDb();
});

async function lojaComBarbeiro(db: TestDb, slug: string) {
  const [loja] = await db.insert(barbershop).values({ slug, name: slug }).returning();
  const [barbeiro] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: `Barbeiro ${slug}`, role: 'OWNER' })
    .returning();
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: barbeiro.id, weekday: 1, startTime: '09:00:00', endTime: '19:00:00',
  });
  await db.insert(timeOff).values({
    barbershopId: loja.id,
    staffId: barbeiro.id,
    startAt: new Date('2026-09-07T15:00:00Z'),
    endAt: new Date('2026-09-07T16:00:00Z'),
    reason: `Almoço ${slug}`,
  });
  return { loja, barbeiro };
}

describe('consultas da agenda para folgas', () => {
  it('bloqueios e expediente vêm só da própria barbearia', async () => {
    await withTestDb(async (db) => {
      const a = await lojaComBarbeiro(db, 'loja-a');
      await lojaComBarbeiro(db, 'loja-b');

      const bloqueios = await listTimeOffBetween(
        db, a.loja.id, new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z'),
      );
      const expedientes = await listWorkingHoursForBarbershop(db, a.loja.id);

      expect(bloqueios.map((b) => b.reason)).toEqual(['Almoço loja-a']);
      expect(expedientes.every((e) => e.staffId === a.barbeiro.id)).toBe(true);
      expect(expedientes).toHaveLength(1);
    });
  });

  it('bloqueio fora da janela não entra; o que encosta na borda também não', async () => {
    await withTestDb(async (db) => {
      const a = await lojaComBarbeiro(db, 'loja-a');

      const antes = await listTimeOffBetween(
        db, a.loja.id, new Date('2026-09-07T16:00:00Z'), new Date('2026-09-08T00:00:00Z'),
      );
      const dentro = await listTimeOffBetween(
        db, a.loja.id, new Date('2026-09-07T15:30:00Z'), new Date('2026-09-08T00:00:00Z'),
      );

      expect(antes).toHaveLength(0);
      expect(dentro).toHaveLength(1);
    });
  });
});
