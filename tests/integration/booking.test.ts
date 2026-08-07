import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, appointment, customer } from '@/db/schema';
import {
  getAvailability,
  createAppointment,
  cancelAppointment,
  SlotUnavailableError,
  SlotTakenError,
  OutsideBookingWindowError,
  CancelNotAllowedError,
} from '@/domain/booking';

const SEGUNDA = '2026-09-07'; // segunda-feira

async function semear(
  db: TestDb,
  opts: { duracao?: number; slot?: number; avanco?: number } = {},
) {
  const [loja] = await db
    .insert(barbershop)
    .values({
      slug: 'teste',
      name: 'Teste',
      slotMinutes: opts.slot ?? 30,
      minLeadMinutes: 0,
      // Janela larga por padrão: as datas fixas destes testes ficam a mais de um
      // mês do "hoje" real e não podem depender do dia em que a suíte roda.
      maxAdvanceDays: opts.avanco ?? 3650,
    })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [maria] = await db.insert(staff).values({ barbershopId: loja.id, name: 'Maria' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: opts.duracao ?? 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values([
    { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id },
    { barbershopId: loja.id, staffId: maria.id, serviceId: corte.id },
  ]);
  await db.insert(workingHours).values([
    { barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00' },
    { barbershopId: loja.id, staffId: maria.id, weekday: 1, startTime: '09:00:00', endTime: '10:00:00' },
  ]);
  return { loja, joao, maria, corte };
}

const CLIENTE = { name: 'Cliente', phone: '11999998888' };

describe('getAvailability', () => {
  it('lista os horários de um barbeiro específico', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const slots = await getAvailability(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id, date: SEGUNDA,
      });
      expect(slots).toHaveLength(4);
      expect(slots[0].start.toISOString()).toBe('2026-09-07T12:00:00.000Z');
    });
  });

  it('agrega os horários de todos os barbeiros quando nenhum é escolhido', async () => {
    await withTestDb(async (db) => {
      const { loja, corte } = await semear(db);
      const slots = await getAvailability(db, { barbershopId: loja.id, serviceId: corte.id, date: SEGUNDA });
      const inicios = [...new Set(slots.map((s) => s.start.toISOString()))];
      expect(inicios).toHaveLength(4);
    });
  });

  it('recusa dia além de hoje + maxAdvanceDays', async () => {
    await withTestDb(async (db) => {
      const { loja, corte } = await semear(db, { avanco: 30 });
      // 07/09 fica a 31 dias de 07/08 no fuso da barbearia: um dia além do teto.
      await expect(
        getAvailability(db, {
          barbershopId: loja.id,
          serviceId: corte.id,
          date: SEGUNDA,
          now: new Date('2026-08-07T12:00:00Z'),
        }),
      ).rejects.toBeInstanceOf(OutsideBookingWindowError);
    });
  });

  it('aceita o último dia da janela de agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, corte } = await semear(db, { avanco: 30 });
      // 08/08 + 30 dias = 07/09: a fronteira ainda é oferecida.
      const slots = await getAvailability(db, {
        barbershopId: loja.id,
        serviceId: corte.id,
        date: SEGUNDA,
        now: new Date('2026-08-08T12:00:00Z'),
      });
      expect(slots.length).toBeGreaterThan(0);
    });
  });

  it('conta a janela no fuso da barbearia, não em UTC', async () => {
    await withTestDb(async (db) => {
      const { loja, corte } = await semear(db, { avanco: 30 });
      // 08/08 02:00 UTC ainda é 07/08 em São Paulo, então o teto é 06/09.
      await expect(
        getAvailability(db, {
          barbershopId: loja.id,
          serviceId: corte.id,
          date: SEGUNDA,
          now: new Date('2026-08-08T02:00:00Z'),
        }),
      ).rejects.toBeInstanceOf(OutsideBookingWindowError);
    });
  });

  it('usa a duração própria do barbeiro quando existe', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await db
        .update(staffService)
        .set({ durationMinutesOverride: 60 })
        .where(eq(staffService.staffId, joao.id));
      const slots = await getAvailability(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id, date: SEGUNDA,
      });
      expect(slots).toHaveLength(3);
    });
  });
});

describe('createAppointment', () => {
  it('cria o agendamento com snapshot do serviço', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.serviceNameSnapshot).toBe('Corte');
      expect(linha.servicePriceCentsSnapshot).toBe(4000);
      expect(linha.serviceDurationMinutesSnapshot).toBe(30);
      expect(linha.endAt.toISOString()).toBe('2026-09-07T12:30:00.000Z');
    });
  });

  it('arredonda o fim para slots inteiros quando o serviço não fecha na grade', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, { duracao: 45 });
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.serviceDurationMinutesSnapshot).toBe(45);
      expect(linha.endAt.toISOString()).toBe('2026-09-07T13:00:00.000Z');
    });
  });

  it('recusa horário que não está na grade oferecida', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T12:10:00Z'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('recusa agendamento além de hoje + maxAdvanceDays', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, { avanco: 30 });
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
          now: new Date('2026-08-07T12:00:00Z'),
        }),
      ).rejects.toBeInstanceOf(OutsideBookingWindowError);
    });
  });

  it('deixa o painel agendar além da janela do público', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, { avanco: 30 });
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PANEL',
        now: new Date('2026-08-07T12:00:00Z'),
      });
      expect(criado.appointmentId).toBeTruthy();
    });
  });

  it('recusa horário fora do expediente', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T20:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('recusa o segundo agendamento no mesmo horário do mesmo barbeiro', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const args = {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC' as const,
      };
      await createAppointment(db, args);
      await expect(createAppointment(db, args)).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('devolve SlotTakenError para quem perde a corrida por um horário', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const pedido = (phone: string) =>
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T12:00:00Z'),
          customer: { name: 'Cliente', phone }, origin: 'PUBLIC',
        });

      // Simultâneas de verdade: as duas recalculam a grade antes de qualquer
      // insert, então quem chega depois só descobre o conflito na constraint.
      const [a, b] = await Promise.allSettled([pedido('11999998888'), pedido('11977776666')]);

      const aceitos = [a, b].filter((r) => r.status === 'fulfilled');
      const recusados = [a, b].filter((r) => r.status === 'rejected');
      expect(aceitos).toHaveLength(1);
      expect(recusados).toHaveLength(1);
      expect((recusados[0] as PromiseRejectedResult).reason).toBeInstanceOf(SlotTakenError);

      const linhas = await db.select().from(appointment).where(eq(appointment.staffId, joao.id));
      expect(linhas).toHaveLength(1);
    });
  });

  it('escolhe um barbeiro livre no modo "qualquer"', async () => {
    await withTestDb(async (db) => {
      const { loja, corte, joao, maria } = await semear(db);
      const primeiro = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const segundo = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Outro', phone: '11977776666' }, origin: 'PUBLIC',
      });
      expect(new Set([primeiro.staffId, segundo.staffId])).toEqual(new Set([joao.id, maria.id]));
    });
  });

  it('manda "qualquer barbeiro" para quem tem menos agendamentos no dia', async () => {
    await withTestDb(async (db) => {
      const { loja, corte, joao, maria } = await semear(db);
      // João já tem 09:30 marcado; Maria está com o dia vazio.
      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:30:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });

      const escolhido = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Outro', phone: '11977776666' }, origin: 'PUBLIC',
      });

      // Sem o desempate, sai sempre o primeiro em ordem alfabética — João.
      expect(escolhido.staffId).toBe(maria.id);
    });
  });

  it('grava no snapshot a duração que o barbeiro realmente usa', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await db
        .update(staffService)
        .set({ durationMinutesOverride: 60 })
        .where(eq(staffService.staffId, joao.id));

      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });

      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.serviceDurationMinutesSnapshot).toBe(60);
      expect(linha.endAt.toISOString()).toBe('2026-09-07T13:00:00.000Z');
    });
  });

  it('não deixa a superfície pública renomear cliente que já existe', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await db
        .insert(customer)
        .values({ barbershopId: loja.id, name: 'Zé do Bairro', phone: CLIENTE.phone });

      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'CLIQUE AQUI promo', phone: CLIENTE.phone }, origin: 'PUBLIC',
      });

      const [linha] = await db.select().from(customer).where(eq(customer.phone, CLIENTE.phone));
      expect(linha.name).toBe('Zé do Bairro');
    });
  });

  it('deixa o painel corrigir o nome do cliente', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await db
        .insert(customer)
        .values({ barbershopId: loja.id, name: 'Ze', phone: CLIENTE.phone });

      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'José da Silva', phone: CLIENTE.phone }, origin: 'PANEL',
      });

      const [linha] = await db.select().from(customer).where(eq(customer.phone, CLIENTE.phone));
      expect(linha.name).toBe('José da Silva');
    });
  });

  it('não deixa rastro no cliente quando o horário é perdido na constraint', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await db
        .insert(customer)
        .values({ barbershopId: loja.id, name: 'Zé do Bairro', phone: CLIENTE.phone });

      // Bloqueia o horário só para a constraint EXCLUDE: a linha é de outra
      // barbearia, então o recálculo da grade não a enxerga.
      const [outra] = await db.insert(barbershop).values({ slug: 'outra', name: 'Outra' }).returning();
      const [fantasma] = await db
        .insert(customer)
        .values({ barbershopId: outra.id, name: 'Fantasma', phone: '11900000000' })
        .returning();
      await db.insert(appointment).values({
        barbershopId: outra.id, staffId: joao.id, customerId: fantasma.id,
        serviceNameSnapshot: 'Corte', servicePriceCentsSnapshot: 4000,
        serviceDurationMinutesSnapshot: 30,
        startAt: new Date('2026-09-07T12:00:00Z'), endAt: new Date('2026-09-07T12:30:00Z'),
      });

      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T12:00:00Z'),
          customer: { name: 'Nome Trocado', phone: CLIENTE.phone }, origin: 'PANEL',
        }),
      ).rejects.toBeInstanceOf(SlotTakenError);

      const [linha] = await db
        .select()
        .from(customer)
        .where(and(eq(customer.barbershopId, loja.id), eq(customer.phone, CLIENTE.phone)));
      expect(linha.name).toBe('Zé do Bairro');
    });
  });

  it('reaproveita o cliente pelo telefone', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, maria, corte } = await semear(db);
      const a = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const b = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: maria.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linhaA] = await db.select().from(appointment).where(eq(appointment.id, a.appointmentId));
      const [linhaB] = await db.select().from(appointment).where(eq(appointment.id, b.appointmentId));
      expect(linhaA.customerId).toBe(linhaB.customerId);
    });
  });
});

describe('cancelAppointment', () => {
  it('libera o horário para um novo agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const args = {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC' as const,
      };
      const criado = await createAppointment(db, args);
      await cancelAppointment(db, loja.id, criado.appointmentId);
      const novo = await createAppointment(db, args);
      expect(novo.appointmentId).not.toBe(criado.appointmentId);
    });
  });

  it('recusa o link do cliente para agendamento já concluído', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      await db.update(appointment).set({ status: 'DONE' }).where(eq(appointment.id, criado.appointmentId));

      await expect(
        cancelAppointment(db, loja.id, criado.appointmentId, { origin: 'CUSTOMER' }),
      ).rejects.toBeInstanceOf(CancelNotAllowedError);

      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.status).toBe('DONE');
    });
  });

  it('recusa o link do cliente para agendamento marcado como falta', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      await db.update(appointment).set({ status: 'NO_SHOW' }).where(eq(appointment.id, criado.appointmentId));

      await expect(
        cancelAppointment(db, loja.id, criado.appointmentId, { origin: 'CUSTOMER' }),
      ).rejects.toBeInstanceOf(CancelNotAllowedError);
    });
  });

  it('recusa o link do cliente depois que o atendimento começou', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });

      await expect(
        cancelAppointment(db, loja.id, criado.appointmentId, {
          origin: 'CUSTOMER', now: new Date('2026-09-07T12:00:01Z'),
        }),
      ).rejects.toBeInstanceOf(CancelNotAllowedError);

      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.status).toBe('BOOKED');
    });
  });

  it('protege o link do cliente mesmo sem origem declarada', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      await db.update(appointment).set({ status: 'DONE' }).where(eq(appointment.id, criado.appointmentId));

      // O padrão é o caminho mais restrito: quem quiser cancelar um atendimento
      // fechado precisa dizer que está no painel.
      await expect(
        cancelAppointment(db, loja.id, criado.appointmentId),
      ).rejects.toBeInstanceOf(CancelNotAllowedError);
    });
  });

  it('deixa o painel cancelar atendimento que já passou', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });

      await cancelAppointment(db, loja.id, criado.appointmentId, {
        origin: 'PANEL', now: new Date('2026-09-09T12:00:00Z'),
      });

      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.status).toBe('CANCELED');
    });
  });

  it('não cancela agendamento de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [outra] = await db.insert(barbershop).values({ slug: 'outra', name: 'Outra' }).returning();
      await expect(cancelAppointment(db, outra.id, criado.appointmentId)).rejects.toThrow();
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.status).toBe('BOOKED');
    });
  });
});
