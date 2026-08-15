import { describe, it, expect, vi, afterAll } from 'vitest';

/**
 * A `rescheduleAppointmentAction` pelo caminho de verdade: `FormData` de um
 * lado, linha do banco do outro.
 *
 * Existe por um motivo específico. A primeira versão desta action recebia dia e
 * hora colados (`'2026-09-07 11:00'`) e os lia com `DateTime.fromISO` — que
 * **não** aceita o espaço no lugar do `T` e devolve inválido sempre. O domínio
 * estava certo, os testes de unidade passavam, e remarcar não funcionava uma
 * única vez. Só o formulário inteiro pega isso.
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
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../../../../tests/helpers/db';
import {
  appointment,
  barbershop,
  customer,
  notificationLog,
  service,
  staff,
  staffService,
} from '@/db/schema';
import { closeDb } from '@/db/client';
import { rescheduleAppointmentAction } from './actions';

const SEGUNDA = '2026-09-07';
const TZ = 'America/Sao_Paulo';

function em(hora: string): Date {
  return DateTime.fromISO(`${SEGUNDA}T${hora}`, { zone: TZ }).toJSDate();
}

afterAll(async () => {
  await closeDb();
});

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'remarcar-action', name: 'Barbearia', timeZone: TZ })
    .returning();
  const [marcao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Marcão', role: 'OWNER', userId: 'u-dono' })
    .returning();
  const [tiago] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Tiago', role: 'BARBER', userId: 'u-tiago' })
    .returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 5000 })
    .returning();
  await db.insert(staffService).values([
    { barbershopId: loja.id, staffId: marcao.id, serviceId: corte.id },
    { barbershopId: loja.id, staffId: tiago.id, serviceId: corte.id },
  ]);
  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId: loja.id, name: 'Marcos', phone: '11999990000' })
    .returning();
  const [alvo] = await db
    .insert(appointment)
    .values({
      barbershopId: loja.id,
      staffId: marcao.id,
      customerId: cliente.id,
      serviceId: corte.id,
      serviceNameSnapshot: 'Corte',
      servicePriceCentsSnapshot: 5000,
      serviceDurationMinutesSnapshot: 30,
      startAt: em('09:00'),
      endAt: em('09:30'),
    })
    .returning();

  sessaoFalsa.userId = 'u-dono';
  return { loja, marcao, tiago, alvo };
}

/** O que a folha de remarcação manda: os campos da faixa que o dedo apontou. */
function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.set(chave, valor);
  return dados;
}

describe('rescheduleAppointmentAction', () => {
  it('remarca com o dia e a hora que a faixa apontou', async () => {
    await withTestDb(async (db) => {
      const { alvo } = await semear(db);

      const retorno = await rescheduleAppointmentAction(
        {},
        formulario({ appointmentId: alvo.id, date: SEGUNDA, hora: '11:00', staffId: '' }),
      );

      expect(retorno).toEqual({ ok: true });
      const [depois] = await db.select().from(appointment).where(eq(appointment.id, alvo.id));
      expect(depois.startAt.getTime()).toBe(em('11:00').getTime());
      expect(depois.endAt.getTime()).toBe(em('11:30').getTime());
    });
  });

  it('leva o cliente para a cadeira do vão clicado, não para a de sempre', async () => {
    await withTestDb(async (db) => {
      const { alvo, tiago } = await semear(db);

      await rescheduleAppointmentAction(
        {},
        formulario({ appointmentId: alvo.id, date: SEGUNDA, hora: '11:00', staffId: tiago.id }),
      );

      const [depois] = await db.select().from(appointment).where(eq(appointment.id, alvo.id));
      expect(depois.staffId).toBe(tiago.id);
    });
  });

  it('o interruptor desligado não deixa rastro de aviso', async () => {
    await withTestDb(async (db) => {
      const { alvo } = await semear(db);

      // Checkbox desmarcado simplesmente não vai no `FormData`.
      await rescheduleAppointmentAction(
        {},
        formulario({ appointmentId: alvo.id, date: SEGUNDA, hora: '11:00', staffId: '' }),
      );

      expect(await db.select().from(notificationLog)).toHaveLength(0);
    });
  });

  it('o interruptor ligado registra a intenção de avisar', async () => {
    await withTestDb(async (db) => {
      const { alvo } = await semear(db);

      await rescheduleAppointmentAction(
        {},
        formulario({
          appointmentId: alvo.id,
          date: SEGUNDA,
          hora: '11:00',
          staffId: '',
          avisarCliente: 'sim',
        }),
      );

      const [aviso] = await db.select().from(notificationLog);
      expect(aviso.type).toBe('RESCHEDULE');
      expect(aviso.status).toBe('FAILED');
    });
  });

  it('devolve a recusa em vez de estourar quando o horário já é de outro', async () => {
    await withTestDb(async (db) => {
      const { loja, marcao, alvo } = await semear(db);
      const [outro] = await db
        .select()
        .from(customer)
        .where(eq(customer.barbershopId, loja.id))
        .limit(1);
      await db.insert(appointment).values({
        barbershopId: loja.id,
        staffId: marcao.id,
        customerId: outro.id,
        serviceNameSnapshot: 'Corte',
        servicePriceCentsSnapshot: 5000,
        serviceDurationMinutesSnapshot: 30,
        startAt: em('11:00'),
        endAt: em('11:30'),
      });

      const retorno = await rescheduleAppointmentAction(
        {},
        formulario({ appointmentId: alvo.id, date: SEGUNDA, hora: '11:15', staffId: '' }),
      );

      expect(retorno.erro).toMatch(/já tem atendimento ou bloqueio/);
      expect(retorno.ok).toBeUndefined();
    });
  });

  it('recusa hora que não é hora, sem chegar ao banco', async () => {
    await withTestDb(async (db) => {
      const { alvo } = await semear(db);

      const retorno = await rescheduleAppointmentAction(
        {},
        formulario({ appointmentId: alvo.id, date: SEGUNDA, hora: '25:99', staffId: '' }),
      );

      expect(retorno.erro).toBe('Informe um horário válido.');
      const [intacto] = await db.select().from(appointment).where(eq(appointment.id, alvo.id));
      expect(intacto.startAt.getTime()).toBe(em('09:00').getTime());
    });
  });
});
