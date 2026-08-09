import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import {
  barbershop, staff, service, staffService, workingHours, appointment,
} from '@/db/schema';
import {
  getAvailability,
  createAppointment,
  createWalkInAppointment,
  SlotUnavailableError,
  OutsideBookingWindowError,
} from '@/domain/booking';

/**
 * O encaixe nas pontas amplia o que `createAppointment` aceita. Estes testes
 * fecham a porta do outro lado: com a segunda passagem ligada de verdade — há
 * um atendimento no meio da tarde, então existem pontas oferecidas —, as quatro
 * recusas da superfície pública continuam valendo.
 */

const SEGUNDA = '2026-09-07'; // segunda-feira
const TZ = 'America/Sao_Paulo';
const CLIENTE = { name: 'Cliente', phone: '11999998888' };

function em(hora: string): Date {
  return DateTime.fromISO(`${SEGUNDA}T${hora}`, { zone: TZ }).toJSDate();
}

/**
 * Serviço de 45 numa grade de 30, expediente 09:00–12:00 e 14:00–18:00.
 * `minLeadMinutes` e `maxAdvanceDays` entram por parâmetro porque cada recusa
 * precisa de um valor diferente.
 */
async function semear(db: TestDb, opts: { lead?: number; avanco?: number } = {}) {
  const [loja] = await db
    .insert(barbershop)
    .values({
      slug: 'recusas',
      name: 'Barbearia das Recusas',
      timeZone: TZ,
      slotMinutes: 30,
      minLeadMinutes: opts.lead ?? 0,
      maxAdvanceDays: opts.avanco ?? 3650,
    })
    .returning();
  const [joao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'João', role: 'OWNER' })
    .returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 45, priceCents: 5000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
  await db.insert(workingHours).values([
    { barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '12:00:00' },
    { barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '14:00:00', endTime: '18:00:00' },
  ]);
  return { loja, joao, corte };
}

/** Atendimento das 15:00 às 15:45, fora da grade: é ele que cria as pontas. */
async function ocuparATarde(db: TestDb, loja: { id: string }, joao: { id: string }, corte: { id: string }) {
  await createWalkInAppointment(db, {
    barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
    startAt: em('15:00'), customer: { name: 'Na cadeira', phone: '11900001111' },
  });
}

describe('createAppointment com o encaixe nas pontas ligado', () => {
  it('o encaixe está mesmo ligado: 14:15, 15:45 e 17:15 são oferecidos e a grade sozinha não os teria', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await ocuparATarde(db, loja, joao, corte);

      const slots = await getAvailability(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id, date: SEGUNDA,
      });
      const horas = slots.map((s) => DateTime.fromJSDate(s.start).setZone(TZ).toFormat('HH:mm'));

      // Pontas: encostado no fim do espaço 14:00–15:00, no rabo do atendimento
      // e encostado no fim do expediente.
      expect(horas).toContain('14:15');
      expect(horas).toContain('15:45');
      expect(horas).toContain('17:15');
      // Nenhuma delas cai de 30 em 30 a partir das 09:00 ou das 14:00.
      for (const ponta of ['14:15', '15:45', '17:15']) {
        const minuto = Number(ponta.slice(3));
        expect(minuto % 30).not.toBe(0);
      }

      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: em('14:15'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.endAt.toISOString()).toBe(em('15:00').toISOString());
    });
  });

  it('recusa 1 — horário que colide com atendimento existente', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await ocuparATarde(db, loja, joao, corte);

      // 14:20 + 45 = 15:05, cinco minutos por cima do atendimento das 15:00.
      // É vizinho da ponta legítima das 14:15, e mesmo assim tem de cair.
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('14:20'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      // E o começo do próprio atendimento também.
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('15:00'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      // 15:30 começa dentro dele.
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('15:30'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      expect(await db.select().from(appointment).where(eq(appointment.barbershopId, loja.id))).toHaveLength(1);
    });
  });

  it('recusa 2 — horário fora do expediente, inclusive emendando o almoço e passando das 18:00', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await ocuparATarde(db, loja, joao, corte);

      // 11:30 + 45 = 12:15: começa no expediente e vaza para o almoço.
      // A ponta legítima da manhã é 11:15, um quarto de hora antes.
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('11:30'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      // Dentro do almoço.
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('12:30'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      // 17:30 + 45 = 18:15: passa do fim do expediente. A ponta é 17:15.
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('17:30'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      // Antes de abrir.
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('08:15'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      expect(await db.select().from(appointment).where(eq(appointment.barbershopId, loja.id))).toHaveLength(1);
    });
  });

  it('recusa 3 — a ponta respeita a antecedência mínima (§3.4)', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, { lead: 60 });
      await ocuparATarde(db, loja, joao, corte);

      // São 14:00 na barbearia e a antecedência é de uma hora: nada antes das
      // 15:00 pode ser vendido. A ponta das 14:15 é exatamente o horário que o
      // encaixe do balcão aceitaria e a superfície pública não pode aceitar.
      const agora = em('14:00');

      const slots = await getAvailability(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id, date: SEGUNDA, now: agora,
      });
      const horas = slots.map((s) => DateTime.fromJSDate(s.start).setZone(TZ).toFormat('HH:mm'));
      expect(horas).not.toContain('14:15');
      expect(horas).toContain('15:45'); // depois do corte da antecedência, segue oferecida

      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('14:15'), customer: CLIENTE, origin: 'PUBLIC', now: agora,
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      // Prova de que 14:15 é uma ponta de verdade e só a antecedência a derrubou:
      // com o relógio uma hora antes, o mesmo pedido passa.
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: em('14:15'), customer: CLIENTE, origin: 'PUBLIC', now: em('13:00'),
      });
      expect(criado.appointmentId).toBeTruthy();
    });
  });

  it('recusa 4 — dia além da janela de agendamento, mesmo sendo uma ponta', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, { avanco: 30 });
      await ocuparATarde(db, loja, joao, corte);

      // 07/09 fica a 31 dias de 07/08 no fuso da barbearia: um dia além do teto.
      const agora = new Date('2026-08-07T12:00:00Z');

      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: em('15:45'), customer: CLIENTE, origin: 'PUBLIC', now: agora,
        }),
      ).rejects.toBeInstanceOf(OutsideBookingWindowError);

      // No dia seguinte a mesma ponta entra: a janela é o que muda, não o encaixe.
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: em('15:45'), customer: CLIENTE, origin: 'PUBLIC',
        now: new Date('2026-08-08T12:00:00Z'),
      });
      expect(criado.appointmentId).toBeTruthy();
    });
  });
});
