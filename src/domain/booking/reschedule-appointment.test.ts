import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { and, eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../../../tests/helpers/db';
import {
  appointment,
  barbershop,
  customer,
  notificationLog,
  service,
  staff,
  staffService,
} from '@/db/schema';
import { rescheduleAppointment, ENVIO_PENDENTE } from './reschedule-appointment';
import { MENSAGEM_DE_COLISAO } from './create-walk-in';
import { NotFoundError, SlotTakenError, SlotUnavailableError } from './errors';

const SEGUNDA = '2026-09-07';
const TZ = 'America/Sao_Paulo';

/** Instante absoluto de uma hora local da barbearia naquela segunda. */
function em(hora: string): Date {
  return DateTime.fromISO(`${SEGUNDA}T${hora}`, { zone: TZ }).toJSDate();
}

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'remarcar', name: 'Barbearia da Remarcação', timeZone: TZ })
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
  // Só o Marcão faz Corte: é o que trava o caso "esse barbeiro não faz esse serviço".
  await db
    .insert(staffService)
    .values({ barbershopId: loja.id, staffId: marcao.id, serviceId: corte.id });
  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId: loja.id, name: 'Marcos', phone: '11999990000' })
    .returning();

  async function marcar(
    inicio: string,
    fim: string,
    quem: string = marcao.id,
    status: 'BOOKED' | 'CANCELED' = 'BOOKED',
  ) {
    const [linha] = await db
      .insert(appointment)
      .values({
        barbershopId: loja.id,
        staffId: quem,
        customerId: cliente.id,
        serviceId: corte.id,
        serviceNameSnapshot: 'Corte',
        servicePriceCentsSnapshot: 5000,
        serviceDurationMinutesSnapshot: 30,
        startAt: em(inicio),
        endAt: em(fim),
        status,
      })
      .returning();
    return linha;
  }

  return { loja, marcao, tiago, corte, cliente, marcar };
}

function ler(db: TestDb, id: string) {
  return db.select().from(appointment).where(eq(appointment.id, id)).limit(1);
}

describe('rescheduleAppointment', () => {
  it('move o atendimento e preserva o snapshot de serviço e preço', async () => {
    await withTestDb(async (db) => {
      const { loja, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');

      await rescheduleAppointment(db, {
        appointmentId: alvo.id,
        barbershopId: loja.id,
        novoInicio: em('11:00'),
        avisarCliente: false,
      });

      const [depois] = await ler(db, alvo.id);
      expect(depois.startAt.getTime()).toBe(em('11:00').getTime());
      // O snapshot é o que o histórico e a comissão leem: remarcar não renegocia.
      expect(depois.serviceNameSnapshot).toBe('Corte');
      expect(depois.servicePriceCentsSnapshot).toBe(5000);
      expect(depois.serviceDurationMinutesSnapshot).toBe(30);
    });
  });

  it('preserva a duração ao mudar de hora — o fim recalcula do início', async () => {
    await withTestDb(async (db) => {
      const { loja, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');

      await rescheduleAppointment(db, {
        appointmentId: alvo.id,
        barbershopId: loja.id,
        novoInicio: em('11:00'),
        avisarCliente: false,
      });

      const [depois] = await ler(db, alvo.id);
      expect(depois.endAt.getTime()).toBe(em('11:30').getTime());
    });
  });

  it('recusa colisão com a mesma mensagem do encaixe', async () => {
    await withTestDb(async (db) => {
      const { loja, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');
      await marcar('11:00', '11:30');

      await expect(
        rescheduleAppointment(db, {
          appointmentId: alvo.id,
          barbershopId: loja.id,
          novoInicio: em('11:15'),
          avisarCliente: false,
        }),
      ).rejects.toThrow(SlotTakenError);

      // Quem recusou foi a constraint EXCLUDE, e a tradução tem que ser a do
      // encaixe — sem ela volta 500 em vez de 409.
      await expect(
        rescheduleAppointment(db, {
          appointmentId: alvo.id,
          barbershopId: loja.id,
          novoInicio: em('11:15'),
          avisarCliente: false,
        }),
      ).rejects.toThrow(MENSAGEM_DE_COLISAO);

      const [intacto] = await ler(db, alvo.id);
      expect(intacto.startAt.getTime()).toBe(em('09:00').getTime());
    });
  });

  it('não colide consigo mesmo ao mover para o horário que já ocupa', async () => {
    await withTestDb(async (db) => {
      const { loja, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');

      await expect(
        rescheduleAppointment(db, {
          appointmentId: alvo.id,
          barbershopId: loja.id,
          novoInicio: em('09:00'),
          avisarCliente: true,
        }),
      ).resolves.toBeUndefined();

      // No-op de verdade: nem move, nem avisa cliente nenhum de nada.
      const avisos = await db.select().from(notificationLog);
      expect(avisos).toHaveLength(0);
    });
  });

  it('recusa remarcar o que já foi cancelado', async () => {
    await withTestDb(async (db) => {
      const { loja, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30', undefined, 'CANCELED');

      await expect(
        rescheduleAppointment(db, {
          appointmentId: alvo.id,
          barbershopId: loja.id,
          novoInicio: em('11:00'),
          avisarCliente: false,
        }),
      ).rejects.toThrow(SlotUnavailableError);
    });
  });

  it('registra a intenção de avisar quando avisarCliente é true', async () => {
    await withTestDb(async (db) => {
      const { loja, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');

      await rescheduleAppointment(db, {
        appointmentId: alvo.id,
        barbershopId: loja.id,
        novoInicio: em('11:00'),
        avisarCliente: true,
      });

      const [aviso] = await db
        .select()
        .from(notificationLog)
        .where(
          and(
            eq(notificationLog.appointmentId, alvo.id),
            eq(notificationLog.type, 'RESCHEDULE'),
          ),
        );
      expect(aviso.status).toBe('FAILED');
      expect(aviso.error).toBe(ENVIO_PENDENTE);
    });
  });

  it('não registra aviso quando avisarCliente é false', async () => {
    await withTestDb(async (db) => {
      const { loja, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');

      await rescheduleAppointment(db, {
        appointmentId: alvo.id,
        barbershopId: loja.id,
        novoInicio: em('11:00'),
        avisarCliente: false,
      });

      expect(await db.select().from(notificationLog)).toHaveLength(0);
    });
  });

  it('remarca duas vezes sem esbarrar no único do notificationLog', async () => {
    await withTestDb(async (db) => {
      const { loja, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');

      await rescheduleAppointment(db, {
        appointmentId: alvo.id,
        barbershopId: loja.id,
        novoInicio: em('11:00'),
        avisarCliente: true,
      });
      await rescheduleAppointment(db, {
        appointmentId: alvo.id,
        barbershopId: loja.id,
        novoInicio: em('15:00'),
        avisarCliente: true,
      });

      const [depois] = await ler(db, alvo.id);
      expect(depois.startAt.getTime()).toBe(em('15:00').getTime());

      // Uma linha por assunto, retomada — é o desenho de fila que o
      // `notify.ts` já usa, e é o que mantém o `ON CONFLICT (appointment_id,
      // type)` dele funcionando.
      const avisos = await db.select().from(notificationLog);
      expect(avisos).toHaveLength(1);
      expect(avisos[0].error).toBe(ENVIO_PENDENTE);
    });
  });

  it('recusa mudar para um barbeiro que não faz aquele serviço', async () => {
    await withTestDb(async (db) => {
      const { loja, tiago, marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');

      await expect(
        rescheduleAppointment(db, {
          appointmentId: alvo.id,
          barbershopId: loja.id,
          novoInicio: em('11:00'),
          novoStaffId: tiago.id,
          avisarCliente: false,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  it('muda de barbeiro quando ele faz o serviço, sem mexer no snapshot', async () => {
    await withTestDb(async (db) => {
      const { loja, tiago, corte, marcar } = await semear(db);
      await db
        .insert(staffService)
        .values({ barbershopId: loja.id, staffId: tiago.id, serviceId: corte.id });
      const alvo = await marcar('09:00', '09:30');

      await rescheduleAppointment(db, {
        appointmentId: alvo.id,
        barbershopId: loja.id,
        novoInicio: em('11:00'),
        novoStaffId: tiago.id,
        avisarCliente: false,
      });

      const [depois] = await ler(db, alvo.id);
      expect(depois.staffId).toBe(tiago.id);
      expect(depois.servicePriceCentsSnapshot).toBe(5000);
    });
  });

  it('não remarca atendimento de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { marcar } = await semear(db);
      const alvo = await marcar('09:00', '09:30');
      const [outra] = await db
        .insert(barbershop)
        .values({ slug: 'vizinha', name: 'Vizinha', timeZone: TZ })
        .returning();

      await expect(
        rescheduleAppointment(db, {
          appointmentId: alvo.id,
          barbershopId: outra.id,
          novoInicio: em('11:00'),
          avisarCliente: false,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
