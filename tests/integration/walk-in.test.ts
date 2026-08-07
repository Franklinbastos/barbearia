import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

/**
 * Sessão falsa do painel: o `requireSession` de verdade roda contra o banco de
 * teste, só o Better-Auth é substituído. O encaixe é operação de balcão, então
 * o papel BARBER também precisa passar.
 */
const sessaoFalsa = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => (sessaoFalsa.userId ? { user: { id: sessaoFalsa.userId } } : null),
    },
  },
}));

import { DateTime } from 'luxon';
import { and, eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import {
  barbershop, staff, service, staffService, workingHours, timeOff, appointment, customer,
} from '@/db/schema';
import { closeDb } from '@/db/client';
import {
  createAppointment,
  createWalkInAppointment,
  NotFoundError,
  SlotTakenError,
  SlotUnavailableError,
} from '@/domain/booking';
import { createManualAppointmentAction } from '@/app/app/agenda/actions';

const SEGUNDA = '2026-09-07'; // segunda-feira
const TZ = 'America/Sao_Paulo';
const CLIENTE = { name: 'Cliente Balcão', phone: '11999998888' };
const ESTADO_INICIAL = {};

/** Instante absoluto de uma hora local da barbearia naquela segunda. */
function em(hora: string): Date {
  return DateTime.fromISO(`${SEGUNDA}T${hora}`, { zone: TZ }).toJSDate();
}

beforeEach(() => {
  sessaoFalsa.userId = null;
});

afterAll(async () => {
  await closeDb();
});

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    .values({
      slug: 'encaixe',
      name: 'Barbearia do Encaixe',
      timeZone: TZ,
      slotMinutes: 30,
      // O caso do review: antecedência de 1 hora bloqueia o balcão.
      minLeadMinutes: 60,
      maxAdvanceDays: 3650,
    })
    .returning();
  const [joao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'João', role: 'OWNER', userId: 'u-dono' })
    .returning();
  const [pedro] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Pedro', role: 'BARBER', userId: 'u-barbeiro' })
    .returning();
  const [barba] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Barba', durationMinutes: 20, priceCents: 2500 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: barba.id });
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '18:00:00',
  });
  return { loja, joao, pedro, barba };
}

async function linhas(db: TestDb, barbershopId: string) {
  return db.select().from(appointment).where(eq(appointment.barbershopId, barbershopId));
}

describe('createWalkInAppointment — encaixe do balcão (achado 4)', () => {
  it('agenda em horário que não existe na grade', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);

      const criado = await createWalkInAppointment(db, {
        barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
        startAt: em('14:05'), customer: CLIENTE,
      });

      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.startAt.toISOString()).toBe(em('14:05').toISOString());
      expect(linha.endAt.toISOString()).toBe(em('14:25').toISOString());
      expect(linha.serviceDurationMinutesSnapshot).toBe(20);
      expect(linha.serviceNameSnapshot).toBe('Barba');
      expect(linha.servicePriceCentsSnapshot).toBe(2500);
      expect(linha.origin).toBe('PANEL');
      expect(linha.status).toBe('BOOKED');
    });
  });

  it('a grade pública recusa o mesmo horário que o encaixe aceita', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);

      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('14:05'), customer: CLIENTE, origin: 'PANEL',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('ignora a antecedência mínima da barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      // São 09:30 na barbearia; com `minLeadMinutes` 60 as 10:00 estão fora da grade.
      const agora = em('09:30');

      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('10:00'), customer: CLIENTE, origin: 'PANEL', now: agora,
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      const criado = await createWalkInAppointment(db, {
        barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
        startAt: em('10:00'), customer: CLIENTE,
      });
      expect(criado.appointmentId).toBeTruthy();
    });
  });

  it('recusa encaixe que sobrepõe atendimento existente', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      await createWalkInAppointment(db, {
        barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
        startAt: em('14:00'), customer: CLIENTE,
      });

      // Começa dentro do atendimento que já existe.
      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('14:05'), customer: { name: 'Outro', phone: '11977776666' },
        }),
      ).rejects.toBeInstanceOf(SlotTakenError);

      // Termina dentro dele.
      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('13:50'), customer: { name: 'Outro', phone: '11977776666' },
        }),
      ).rejects.toBeInstanceOf(SlotTakenError);

      // Engole o atendimento inteiro.
      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('13:55'), customer: { name: 'Outro', phone: '11977776666' },
        }),
      ).rejects.toBeInstanceOf(SlotTakenError);

      expect(await linhas(db, loja.id)).toHaveLength(1);
    });
  });

  it('recusa encaixe sobreposto mesmo quando o pré-teste não vê o conflito', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);

      // Linha de outra barbearia com o mesmo barbeiro: o pré-teste é escopado
      // por tenant e não a enxerga, então quem recusa é a constraint EXCLUDE.
      const [outra] = await db.insert(barbershop).values({ slug: 'outra-e', name: 'Outra' }).returning();
      const [fantasma] = await db
        .insert(customer)
        .values({ barbershopId: outra.id, name: 'Fantasma', phone: '11900000000' })
        .returning();
      await db.insert(appointment).values({
        barbershopId: outra.id, staffId: joao.id, customerId: fantasma.id,
        serviceNameSnapshot: 'Corte', servicePriceCentsSnapshot: 4000,
        serviceDurationMinutesSnapshot: 30,
        startAt: em('14:00'), endAt: em('14:30'),
      });

      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('14:10'), customer: CLIENTE,
        }),
      ).rejects.toBeInstanceOf(SlotTakenError);

      expect(await linhas(db, loja.id)).toHaveLength(0);
    });
  });

  it('aceita encaixe que começa exatamente no fim do atendimento anterior', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      await createWalkInAppointment(db, {
        barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
        startAt: em('14:05'), customer: CLIENTE,
      });

      const emenda = await createWalkInAppointment(db, {
        barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
        startAt: em('14:25'), customer: { name: 'Outro', phone: '11977776666' },
      });

      expect(emenda.appointmentId).toBeTruthy();
      expect(await linhas(db, loja.id)).toHaveLength(2);
    });
  });

  it('recusa encaixe dentro de um bloqueio da agenda', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      await db.insert(timeOff).values({
        barbershopId: loja.id, staffId: joao.id,
        startAt: em('15:00'), endAt: em('16:00'), reason: 'Médico',
      });

      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('15:30'), customer: CLIENTE,
        }),
      ).rejects.toBeInstanceOf(SlotTakenError);

      expect(await linhas(db, loja.id)).toHaveLength(0);
    });
  });

  it('recusa barbeiro de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja, barba } = await semear(db);
      const [outra] = await db.insert(barbershop).values({ slug: 'outra-b', name: 'Outra' }).returning();
      const [alheio] = await db
        .insert(staff)
        .values({ barbershopId: outra.id, name: 'Alheio', role: 'BARBER' })
        .returning();

      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: alheio.id,
          startAt: em('14:05'), customer: CLIENTE,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(await db.select().from(appointment)).toHaveLength(0);
    });
  });

  it('recusa serviço que o barbeiro não faz', async () => {
    await withTestDb(async (db) => {
      const { loja, joao } = await semear(db);
      const [progressiva] = await db
        .insert(service)
        .values({ barbershopId: loja.id, name: 'Progressiva', durationMinutes: 90, priceCents: 15000 })
        .returning();

      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: progressiva.id, staffId: joao.id,
          startAt: em('14:05'), customer: CLIENTE,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(await linhas(db, loja.id)).toHaveLength(0);
    });
  });

  it('recusa serviço de outra barbearia e serviço inativo', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      const [outra] = await db.insert(barbershop).values({ slug: 'outra-s', name: 'Outra' }).returning();
      const [alheio] = await db
        .insert(service)
        .values({ barbershopId: outra.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
        .returning();

      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: alheio.id, staffId: joao.id,
          startAt: em('14:05'), customer: CLIENTE,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      await db.update(service).set({ active: false }).where(eq(service.id, barba.id));
      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('14:05'), customer: CLIENTE,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(await db.select().from(appointment)).toHaveLength(0);
    });
  });

  it('recusa barbeiro desativado', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      await db.update(staff).set({ active: false }).where(eq(staff.id, joao.id));

      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: em('14:05'), customer: CLIENTE,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it('usa a duração própria do barbeiro, não a do serviço', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      await db
        .update(staffService)
        .set({ durationMinutesOverride: 15 })
        .where(and(eq(staffService.staffId, joao.id), eq(staffService.serviceId, barba.id)));

      const criado = await createWalkInAppointment(db, {
        barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
        startAt: em('14:05'), customer: CLIENTE,
      });

      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.serviceDurationMinutesSnapshot).toBe(15);
      expect(linha.endAt.toISOString()).toBe(em('14:20').toISOString());
    });
  });

  it('recusa horário inválido sem tocar no banco', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);

      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
          startAt: new Date('nada'), customer: CLIENTE,
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);

      expect(await db.select().from(customer)).toHaveLength(0);
    });
  });

  it('deixa o balcão corrigir o nome do cliente já cadastrado', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      await db.insert(customer).values({ barbershopId: loja.id, name: 'Ze', phone: CLIENTE.phone });

      await createWalkInAppointment(db, {
        barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
        startAt: em('14:05'), customer: { name: 'José da Silva', phone: CLIENTE.phone },
      });

      const [linha] = await db.select().from(customer).where(eq(customer.phone, CLIENTE.phone));
      expect(linha.name).toBe('José da Silva');
    });
  });
});

describe('createManualAppointmentAction — encaixe pelo painel', () => {
  function formulario(campos: Record<string, string>): FormData {
    const form = new FormData();
    for (const [chave, valor] of Object.entries(campos)) form.set(chave, valor);
    return form;
  }

  it('agenda com a hora digitada, fora da grade', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      const estado = await createManualAppointmentAction(
        ESTADO_INICIAL,
        formulario({
          serviceId: barba.id, staffId: joao.id, date: SEGUNDA, horaLivre: '14:05',
          name: CLIENTE.name, phone: '(11) 99999-8888',
        }),
      );

      expect(estado.erro).toBeUndefined();
      expect(estado.ok).toBe(true);
      const [linha] = await linhas(db, loja.id);
      expect(linha.startAt.toISOString()).toBe(em('14:05').toISOString());
      expect(linha.origin).toBe('PANEL');
    });
  });

  it('agenda com o horário escolhido na grade', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      const estado = await createManualAppointmentAction(
        ESTADO_INICIAL,
        formulario({
          serviceId: barba.id, staffId: joao.id, date: SEGUNDA,
          startAt: em('14:30').toISOString(), name: CLIENTE.name, phone: CLIENTE.phone,
        }),
      );

      expect(estado.ok).toBe(true);
      const [linha] = await linhas(db, loja.id);
      expect(linha.startAt.toISOString()).toBe(em('14:30').toISOString());
    });
  });

  it('deixa o barbeiro do balcão encaixar — não é operação só do dono', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      sessaoFalsa.userId = 'u-barbeiro';

      const estado = await createManualAppointmentAction(
        ESTADO_INICIAL,
        formulario({
          serviceId: barba.id, staffId: joao.id, date: SEGUNDA, horaLivre: '14:05',
          name: CLIENTE.name, phone: CLIENTE.phone,
        }),
      );

      expect(estado.erro).toBeUndefined();
      expect(await linhas(db, loja.id)).toHaveLength(1);
    });
  });

  it('devolve erro em pt-BR quando o encaixe sobrepõe outro atendimento', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      await createWalkInAppointment(db, {
        barbershopId: loja.id, serviceId: barba.id, staffId: joao.id,
        startAt: em('14:00'), customer: CLIENTE,
      });
      sessaoFalsa.userId = 'u-dono';

      const estado = await createManualAppointmentAction(
        ESTADO_INICIAL,
        formulario({
          serviceId: barba.id, staffId: joao.id, date: SEGUNDA, horaLivre: '14:10',
          name: 'Outro', phone: '11977776666',
        }),
      );

      expect(estado.ok).toBeUndefined();
      expect(estado.erro).toMatch(/atendimento|bloqueio|horário/i);
      expect(await linhas(db, loja.id)).toHaveLength(1);
    });
  });

  it('recusa hora digitada inválida sem criar agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      const estado = await createManualAppointmentAction(
        ESTADO_INICIAL,
        formulario({
          serviceId: barba.id, staffId: joao.id, date: SEGUNDA, horaLivre: '99:99',
          name: CLIENTE.name, phone: CLIENTE.phone,
        }),
      );

      expect(estado.erro).toMatch(/horário/i);
      expect(await linhas(db, loja.id)).toHaveLength(0);
    });
  });

  it('recusa barbeiro de outra barbearia vindo do formulário', async () => {
    await withTestDb(async (db) => {
      const { barba } = await semear(db);
      const [outra] = await db.insert(barbershop).values({ slug: 'outra-f', name: 'Outra' }).returning();
      const [alheio] = await db
        .insert(staff)
        .values({ barbershopId: outra.id, name: 'Alheio', role: 'BARBER' })
        .returning();
      sessaoFalsa.userId = 'u-dono';

      const estado = await createManualAppointmentAction(
        ESTADO_INICIAL,
        formulario({
          serviceId: barba.id, staffId: alheio.id, date: SEGUNDA, horaLivre: '14:05',
          name: CLIENTE.name, phone: CLIENTE.phone,
        }),
      );

      expect(estado.ok).toBeUndefined();
      expect(estado.erro).toBeTruthy();
      expect(await db.select().from(appointment)).toHaveLength(0);
    });
  });
  it('recusa encaixe com data absurda, que é erro de digitação e não encaixe', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, barba } = await semear(db);
      await expect(
        createWalkInAppointment(db, {
          barbershopId: loja.id,
          serviceId: barba.id,
          staffId: joao.id,
          startAt: new Date('2031-09-07T17:05:00Z'),
          customer: { name: 'Cliente', phone: '11999998888' },
        }),
      ).rejects.toThrow(/365 dias/);
    });
  });

});