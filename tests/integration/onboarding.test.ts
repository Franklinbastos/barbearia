import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, workingHours } from '@/db/schema';
import { createBarbershopForUser } from '@/domain/onboarding/create-barbershop';
import { eq } from 'drizzle-orm';

const DADOS = {
  userId: 'user_1',
  name: 'Barbearia do João',
  slug: 'Barbearia do João',
  timeZone: 'America/Sao_Paulo',
  ownerName: 'João',
};

describe('createBarbershopForUser', () => {
  it('cria barbearia, dono e expediente padrão', async () => {
    await withTestDb(async (db) => {
      const { barbershopId, staffId } = await createBarbershopForUser(db, DADOS);

      const [loja] = await db.select().from(barbershop).where(eq(barbershop.id, barbershopId));
      expect(loja.slug).toBe('barbearia-do-joao');
      expect(loja.slotMinutes).toBe(30);

      const [dono] = await db.select().from(staff).where(eq(staff.id, staffId));
      expect(dono.role).toBe('OWNER');
      expect(dono.userId).toBe('user_1');

      const expediente = await db.select().from(workingHours).where(eq(workingHours.staffId, staffId));
      expect(expediente).toHaveLength(12);
      expect(expediente.every((b) => b.weekday >= 1 && b.weekday <= 6)).toBe(true);
    });
  });

  it('recusa slug já usado', async () => {
    await withTestDb(async (db) => {
      await createBarbershopForUser(db, DADOS);
      await expect(createBarbershopForUser(db, { ...DADOS, userId: 'user_2' })).rejects.toThrow();
    });
  });

  it('não deixa barbearia órfã quando a transação falha', async () => {
    await withTestDb(async (db) => {
      await createBarbershopForUser(db, DADOS);
      await createBarbershopForUser(db, { ...DADOS, userId: 'user_2' }).catch(() => {});
      const todas = await db.select().from(barbershop);
      expect(todas).toHaveLength(1);
    });
  });
});
