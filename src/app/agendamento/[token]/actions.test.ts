import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withTestDb, type TestDb } from '../../../../tests/helpers/db';
import { barbershop, staff, customer, appointment } from '@/db/schema';

/** Callbacks entregues ao `after()` do Next, para o teste executar na mão. */
const trabalhosAdiados: Array<() => unknown | Promise<unknown>> = [];

vi.mock('next/server', () => ({
  after: (cb: () => unknown | Promise<unknown>) => {
    trabalhosAdiados.push(cb);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

type PedidoDeNotificacao = { barbershopId: string; appointmentId: string; type: string };

const notifyOnce = vi.fn(async (_db: unknown, _pedido: PedidoDeNotificacao) => ({
  status: 'SENT' as const,
}));
vi.mock('@/notifications', () => ({
  notifyOnce: (db: unknown, pedido: PedidoDeNotificacao) => notifyOnce(db, pedido),
  getSender: () => ({ send: vi.fn() }),
}));

import { signManageToken } from '@/lib/tokens';
import { cancelByTokenAction } from './actions';

function formulario(token: string): FormData {
  const dados = new FormData();
  dados.set('token', token);
  return dados;
}

/** Um agendamento futuro, gravado de verdade — a action lê pelo `db` do app. */
async function semear(db: TestDb): Promise<string> {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'aviso-cancelamento', name: 'Barbearia Teste', timeZone: 'America/Sao_Paulo' })
    .returning();
  const [joao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'João', role: 'OWNER' })
    .returning();
  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId: loja.id, name: 'Bruno', phone: '11999998888' })
    .returning();
  const [marcado] = await db
    .insert(appointment)
    .values({
      barbershopId: loja.id,
      staffId: joao.id,
      customerId: cliente.id,
      serviceNameSnapshot: 'Corte',
      servicePriceCentsSnapshot: 4000,
      serviceDurationMinutesSnapshot: 30,
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 86_400_000 + 30 * 60_000),
    })
    .returning();

  return marcado.id;
}

describe('cancelByTokenAction', () => {
  beforeEach(() => {
    trabalhosAdiados.length = 0;
    notifyOnce.mockClear();
  });

  it('adia o aviso de cancelamento com after(), em vez de soltar promessa no ar', async () => {
    await withTestDb(async (db) => {
      const appointmentId = await semear(db);
      const token = signManageToken(appointmentId, Date.now() + 3_600_000);

      const estado = await cancelByTokenAction({}, formulario(token));

      expect(estado).toEqual({ cancelado: true });
      // Sem `after`, a Vercel congela a função quando a resposta sai e a
      // notificação morre no meio.
      expect(trabalhosAdiados).toHaveLength(1);
      expect(notifyOnce).not.toHaveBeenCalled();

      await trabalhosAdiados[0]();
      expect(notifyOnce).toHaveBeenCalledTimes(1);
      expect(notifyOnce.mock.calls[0][1]).toMatchObject({ appointmentId, type: 'CANCELLATION' });
    });
  });

  it('não agenda notificação quando o link é inválido', async () => {
    const estado = await cancelByTokenAction({}, formulario('nada.disso.aqui'));

    expect(estado.erro).toBeTruthy();
    expect(trabalhosAdiados).toHaveLength(0);
  });

  it('falha do envio no trabalho adiado não derruba o cancelamento', async () => {
    await withTestDb(async (db) => {
      const appointmentId = await semear(db);
      const token = signManageToken(appointmentId, Date.now() + 3_600_000);
      notifyOnce.mockRejectedValueOnce(new Error('Meta fora do ar'));

      const estado = await cancelByTokenAction({}, formulario(token));
      expect(estado).toEqual({ cancelado: true });

      await expect(trabalhosAdiados[0]()).resolves.not.toThrow();
    });
  });
});
