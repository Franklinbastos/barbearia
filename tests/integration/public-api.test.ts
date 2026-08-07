import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import {
  barbershop, staff, service, staffService, workingHours, customer, appointment, notificationLog,
} from '@/db/schema';
import { GET as getAvailabilityRoute } from '@/app/api/public/[slug]/availability/route';
import { POST as postAppointmentRoute } from '@/app/api/public/[slug]/appointments/route';
import { GET as getCatalogRoute } from '@/app/api/public/[slug]/catalog/route';

/**
 * A rota precisa entregar a notificação a um agendador que sobreviva ao fim da
 * resposta (`after()` do Next). Aqui o agendador é trocado por um que guarda a
 * promessa, para o teste poder esperar o envio terminar.
 */
const { agendado, tarefas } = vi.hoisted(() => ({
  agendado: vi.fn(),
  tarefas: [] as Promise<unknown>[],
}));

vi.mock('@/notifications', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/notifications')>();
  return {
    ...real,
    afterResponse: (tarefa: () => Promise<unknown>) => {
      agendado();
      // O `catch` imita o helper de verdade: envio que falha vira log, nunca
      // rejeição solta. Aqui ele também impede que a tarefa de um teste
      // esbarre no TRUNCATE do teste seguinte.
      tarefas.push(tarefa().catch(() => undefined));
    },
  };
});

const SEGUNDA = '2026-09-07';

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    // Janela larga: as datas fixas deste arquivo ficam a mais de um mês do
    // "hoje" real, e o teto de `maxAdvanceDays` tem teste próprio abaixo.
    .values({
      slug: 'barbearia-teste', name: 'Barbearia Teste', minLeadMinutes: 0, maxAdvanceDays: 3650,
    })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00',
  });
  return { loja, joao, corte };
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

function postAgendamento(
  serviceId: string,
  phone: string,
  extra: Record<string, unknown> = {},
  slug = 'barbearia-teste',
) {
  return postAppointmentRoute(
    new Request(`http://x/api/public/${slug}/appointments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        serviceId,
        startAt: '2026-09-07T12:00:00.000Z',
        name: 'Cliente',
        phone,
        ...extra,
      }),
    }),
    params(slug),
  );
}

describe('API pública', () => {
  it('devolve o catálogo da barbearia', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await getCatalogRoute(new Request('http://x/api/public/barbearia-teste/catalog'), params('barbearia-teste'));
      expect(res.status).toBe(200);
      const bodyJson = await res.json();
      expect(bodyJson.shop.name).toBe('Barbearia Teste');
      expect(bodyJson.services.map((s: { id: string }) => s.id)).toEqual([corte.id]);
      expect(bodyJson.staff[0].serviceIds).toEqual([corte.id]);
    });
  });

  it('devolve 404 para slug inexistente', async () => {
    await withTestDb(async () => {
      const res = await getCatalogRoute(new Request('http://x/api/public/nao-existe/catalog'), params('nao-existe'));
      expect(res.status).toBe(404);
    });
  });

  it('não expõe telefone de cliente no catálogo', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      const res = await getCatalogRoute(new Request('http://x/api/public/barbearia-teste/catalog'), params('barbearia-teste'));
      expect(JSON.stringify(await res.json())).not.toMatch(/phone|telefone/i);
    });
  });

  it('lista horários livres do dia', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const url = `http://x/api/public/barbearia-teste/availability?serviceId=${corte.id}&date=${SEGUNDA}`;
      const res = await getAvailabilityRoute(new Request(url), params('barbearia-teste'));
      expect(res.status).toBe(200);
      const bodyJson = await res.json();
      expect(bodyJson.slots).toHaveLength(4);
      expect(bodyJson.slots[0].startAt).toBe('2026-09-07T12:00:00.000Z');
    });
  });

  it('recusa consulta sem serviceId', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      const res = await getAvailabilityRoute(
        new Request(`http://x/api/public/barbearia-teste/availability?date=${SEGUNDA}`),
        params('barbearia-teste'),
      );
      expect(res.status).toBe(400);
    });
  });

  it('cria o agendamento e devolve o link de gerenciamento', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await postAppointmentRoute(
        new Request('http://x/api/public/barbearia-teste/appointments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            serviceId: corte.id, startAt: '2026-09-07T12:00:00.000Z',
            name: 'Cliente', phone: '11999998888',
          }),
        }),
        params('barbearia-teste'),
      );
      expect(res.status).toBe(201);
      const bodyJson = await res.json();
      expect(bodyJson.manageUrl).toMatch(/\/agendamento\//);
      expect(bodyJson.staffName).toBe('João');
    });
  });

  it('devolve 409 SLOT_UNAVAILABLE quando o horário sumiu da grade', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      expect((await postAgendamento(corte.id, '11999998888')).status).toBe(201);

      // Sequencial: o recálculo da grade já não oferece o horário.
      const segunda = await postAgendamento(corte.id, '11977776666');
      expect(segunda.status).toBe(409);
      expect((await segunda.json()).error).toBe('SLOT_UNAVAILABLE');
    });
  });

  it('devolve 409 SLOT_TAKEN quando só a constraint enxerga o conflito', async () => {
    await withTestDb(async (db) => {
      const { joao, corte } = await semear(db);

      // Perdedor da corrida, de forma determinística: a linha existe para a
      // constraint EXCLUDE (que olha só staff_id + intervalo), mas fica
      // invisível para o recálculo da grade, que filtra por barbershopId.
      const [outra] = await db
        .insert(barbershop)
        .values({ slug: 'outra-loja', name: 'Outra Loja' })
        .returning();
      const [cliente] = await db
        .insert(customer)
        .values({ barbershopId: outra.id, name: 'Fantasma', phone: '11900000000' })
        .returning();
      await db.insert(appointment).values({
        barbershopId: outra.id,
        staffId: joao.id,
        customerId: cliente.id,
        serviceNameSnapshot: 'Corte',
        servicePriceCentsSnapshot: 4000,
        serviceDurationMinutesSnapshot: 30,
        startAt: new Date('2026-09-07T12:00:00.000Z'),
        endAt: new Date('2026-09-07T12:30:00.000Z'),
      });

      const res = await postAgendamento(corte.id, '11999998888');
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('SLOT_TAKEN');
    });
  });

  it('entrega a confirmação a um agendador que sobrevive à resposta', async () => {
    await withTestDb(async (db) => {
      const { loja, corte } = await semear(db);
      agendado.mockClear();
      tarefas.length = 0;

      const res = await postAgendamento(corte.id, '11999998888');
      expect(res.status).toBe(201);

      // `void promessa` morre quando a Vercel congela a função: o envio precisa
      // passar por `after()`, e é isso que o agendador espionado prova.
      expect(agendado).toHaveBeenCalledTimes(1);
      await Promise.all(tarefas);

      const linhas = await db
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.barbershopId, loja.id));
      expect(linhas).toHaveLength(1);
      expect(linhas[0].type).toBe('CONFIRMATION');
    });
  });

  it('recusa dia além da janela de agendamento da barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja, corte } = await semear(db);
      await db.update(barbershop).set({ maxAdvanceDays: 7 }).where(eq(barbershop.id, loja.id));

      const url = `http://x/api/public/barbearia-teste/availability?serviceId=${corte.id}&date=${SEGUNDA}`;
      const res = await getAvailabilityRoute(new Request(url), params('barbearia-teste'));
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('OUTSIDE_BOOKING_WINDOW');

      const criacao = await postAgendamento(corte.id, '11999998888');
      expect(criacao.status).toBe(409);
      expect((await criacao.json()).error).toBe('OUTSIDE_BOOKING_WINDOW');
    });
  });

  it('recusa nome longo demais', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await postAgendamento(corte.id, '11999998888', { name: 'a'.repeat(81) });
      expect(res.status).toBe(400);
    });
  });

  it('recusa nome com link', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await postAgendamento(corte.id, '11999998888', {
        name: 'Promoção https://bit.ly/xyz',
      });
      expect(res.status).toBe(400);
    });
  });

  it('recusa nome com caractere de controle', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await postAgendamento(corte.id, '11999998888', {
        name: 'Cliente‮oãçomorp',
      });
      expect(res.status).toBe(400);
    });
  });

  it('recusa telefone inválido', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await postAppointmentRoute(
        new Request('http://x/api/public/barbearia-teste/appointments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            serviceId: corte.id, startAt: '2026-09-07T12:00:00.000Z', name: 'Cliente', phone: '123',
          }),
        }),
        params('barbearia-teste'),
      );
      expect(res.status).toBe(400);
    });
  });
});
