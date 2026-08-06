import { describe, it, expect } from 'vitest';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours } from '@/db/schema';
import { GET as getAvailabilityRoute } from '@/app/api/public/[slug]/availability/route';
import { POST as postAppointmentRoute } from '@/app/api/public/[slug]/appointments/route';
import { GET as getCatalogRoute } from '@/app/api/public/[slug]/catalog/route';

const SEGUNDA = '2026-09-07';

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'barbearia-teste', name: 'Barbearia Teste', minLeadMinutes: 0 })
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

  it('devolve 409 quando o horário já foi tomado', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const pedido = () =>
        postAppointmentRoute(
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
      expect((await pedido()).status).toBe(201);
      const segunda = await pedido();
      expect(segunda.status).toBe(409);
      expect((await segunda.json()).error).toMatch(/SLOT_/);
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
