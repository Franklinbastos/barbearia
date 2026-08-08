import { describe, it, expect, afterAll } from 'vitest';
import { DateTime } from 'luxon';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours } from '@/db/schema';
import { closeDb } from '@/db/client';
import { createAppointment } from '@/domain/booking';
import { GET as getDiasRoute } from '@/app/api/public/[slug]/availability/days/route';

/**
 * A rota que diz, de uma vez, quais dias da tira têm vaga.
 *
 * Sem ela, descobrir que "sexta não tem" custa tocar dia por dia esperando um
 * fetch a cada um — é o minuto em que o cliente desiste e liga para a loja.
 *
 * As datas aqui são **relativas ao relógio**, nunca fixas: a rota corta a
 * resposta em `hoje` e em `hoje + maxAdvanceDays`, então uma data escrita à mão
 * sai da janela sozinha assim que o calendário passa por ela.
 */
const TZ = 'America/Sao_Paulo';

const hoje = () => DateTime.now().setZone(TZ).startOf('day');
const iso = (d: DateTime) => d.toISODate()!;

async function semear(
  db: TestDb,
  opcoes: { maxAdvanceDays?: number; expediente?: { weekday: number; startTime: string; endTime: string }[] } = {},
) {
  const [loja] = await db
    .insert(barbershop)
    .values({
      slug: 'dias',
      name: 'Dias',
      timeZone: TZ,
      minLeadMinutes: 0,
      maxAdvanceDays: opcoes.maxAdvanceDays ?? 30,
    })
    .returning();
  const [joao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'João', role: 'OWNER' })
    .returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });

  // Segunda a sábado das 09:00 às 18:00; domingo (weekday 7 no luxon) fica de
  // fora de propósito — é o dia que a tira precisa marcar como cheio.
  const expediente =
    opcoes.expediente ??
    [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: '09:00:00', endTime: '18:00:00' }));
  await db.insert(workingHours).values(
    expediente.map((e) => ({ barbershopId: loja.id, staffId: joao.id, ...e })),
  );

  return { loja, joao, corte };
}

function pedir(params: Record<string, string>, slug = 'dias') {
  const busca = new URLSearchParams(params);
  return getDiasRoute(
    new Request(`http://x/api/public/${slug}/availability/days?${busca}`),
    { params: Promise.resolve({ slug }) },
  );
}

type Dia = { date: string; hasSlots: boolean };

async function dias(res: Response): Promise<Dia[]> {
  const corpo = (await res.json()) as { days: Dia[] };
  return corpo.days;
}

afterAll(async () => {
  await closeDb();
});

describe('dias com vaga', () => {
  it('marca quais dias da janela têm vaga', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);

      // A partir de amanhã: hoje depende da hora em que a suíte roda, e depois
      // das 18h ele legitimamente não tem vaga nenhuma.
      const inicio = hoje().plus({ days: 1 });
      const fim = inicio.plus({ days: 6 });

      const res = await pedir({ serviceId: corte.id, from: iso(inicio), to: iso(fim) });
      expect(res.status).toBe(200);

      const lista = await dias(res);
      expect(lista).toHaveLength(7);

      for (const dia of lista) {
        const eDomingo = DateTime.fromISO(dia.date, { zone: TZ }).weekday === 7;
        expect({ date: dia.date, hasSlots: dia.hasSlots }).toEqual({
          date: dia.date,
          hasSlots: !eDomingo,
        });
      }
      // A janela de 7 dias sempre contém exatamente um domingo.
      expect(lista.filter((d) => !d.hasSlots)).toHaveLength(1);
    });
  });

  it('respeita maxAdvanceDays como teto', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db, { maxAdvanceDays: 3 });

      const res = await pedir({
        serviceId: corte.id,
        from: iso(hoje()),
        to: iso(hoje().plus({ days: 20 })),
      });

      const lista = await dias(res);
      // hoje + 3 dias = 4 fichas, e nem uma além do limite da loja.
      expect(lista.map((d) => d.date)).toEqual(
        [0, 1, 2, 3].map((n) => iso(hoje().plus({ days: n }))),
      );
    });
  });

  it('dia inteiramente ocupado vem como sem vaga', async () => {
    await withTestDb(async (db) => {
      const alvo = hoje().plus({ days: 7 });
      const { loja, joao, corte } = await semear(db, {
        // Uma hora de expediente = dois horários de 30 min. Só nesse dia.
        expediente: [{ weekday: alvo.weekday, startTime: '09:00:00', endTime: '10:00:00' }],
      });

      const antes = await dias(await pedir({ serviceId: corte.id, from: iso(alvo), to: iso(alvo) }));
      expect(antes).toEqual([{ date: iso(alvo), hasSlots: true }]);

      for (const hora of [9, 9.5]) {
        await createAppointment(db, {
          barbershopId: loja.id,
          serviceId: corte.id,
          staffId: joao.id,
          startAt: alvo.set({ hour: Math.floor(hora), minute: (hora % 1) * 60 }).toJSDate(),
          customer: { name: 'Cliente', phone: `1199999${hora === 9 ? '1111' : '2222'}` },
          origin: 'PANEL',
        });
      }

      const depois = await dias(await pedir({ serviceId: corte.id, from: iso(alvo), to: iso(alvo) }));
      expect(depois).toEqual([{ date: iso(alvo), hasSlots: false }]);
    });
  });

  it('recusa slug inexistente com 404', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await pedir(
        { serviceId: corte.id, from: iso(hoje()), to: iso(hoje().plus({ days: 3 })) },
        'nao-existe',
      );
      expect(res.status).toBe(404);
    });
  });
});
