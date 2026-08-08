import { describe, it, expect, afterAll } from 'vitest';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, customer, appointment } from '@/db/schema';
import { closeDb } from '@/db/client';
import { signManageToken } from '@/lib/tokens';
import { GET as getIcsRoute } from '@/app/agendamento/[token]/ics/route';

/**
 * O convite de calendário é rota, e não `data:` URI: no Safari do iOS o `.ics`
 * por `data:` não abre confiável, e é justamente onde o cliente está.
 */
const INICIO = new Date('2026-09-07T17:00:00.000Z');

async function semear(db: TestDb, nomeDoServico = 'Corte') {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'ics', name: 'Barbearia do Zé', timeZone: 'America/Sao_Paulo' })
    .returning();
  const [joao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'João', role: 'OWNER' })
    .returning();
  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId: loja.id, name: 'Marcos', phone: '11999998888' })
    .returning();
  const [marcado] = await db
    .insert(appointment)
    .values({
      barbershopId: loja.id,
      staffId: joao.id,
      customerId: cliente.id,
      serviceNameSnapshot: nomeDoServico,
      servicePriceCentsSnapshot: 4000,
      serviceDurationMinutesSnapshot: 30,
      startAt: INICIO,
      endAt: new Date(INICIO.getTime() + 30 * 60_000),
    })
    .returning();
  return { loja, marcado };
}

function pedir(token: string) {
  return getIcsRoute(new Request(`http://x/agendamento/${token}/ics`), {
    params: Promise.resolve({ token }),
  });
}

const tokenValido = (id: string) => signManageToken(id, Date.now() + 86_400_000);

afterAll(async () => {
  await closeDb();
});

describe('convite de calendário', () => {
  it('entrega text/calendar com o começo e o fim do atendimento', async () => {
    await withTestDb(async (db) => {
      const { marcado } = await semear(db);

      const res = await pedir(tokenValido(marcado.id));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/calendar/);

      const corpo = await res.text();
      expect(corpo).toContain('BEGIN:VCALENDAR');
      expect(corpo).toContain('DTSTART:20260907T170000Z');
      expect(corpo).toContain('DTEND:20260907T173000Z');
      expect(corpo).toContain('END:VCALENDAR');
      // O padrão exige CRLF; um .ics com \n sozinho é recusado por leitor sério.
      expect(corpo).toContain('\r\n');
      expect(corpo).not.toMatch(/[^\r]\n/);
    });
  });

  it('escapa vírgula, ponto-e-vírgula e barra invertida do texto', async () => {
    await withTestDb(async (db) => {
      const { marcado } = await semear(db, 'Corte, barba; e\\ sobrancelha');

      const corpo = await (await pedir(tokenValido(marcado.id))).text();

      expect(corpo).toContain('Corte\\, barba\\; e\\\\ sobrancelha');
    });
  });

  it('recusa token inválido com 404', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      expect((await pedir('nao.e.token')).status).toBe(404);
    });
  });
});
