import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { withTestDb } from '../../../../../tests/helpers/db';
import { barbershop, staff, service, staffService, workingHours, customer } from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import type { PanelSession } from '@/lib/session';

vi.mock('@/lib/session', () => ({ requireSession: vi.fn() }));

import { requireSession } from '@/lib/session';
import CustomerDetailPage from './page';

/** Concatena o texto de uma árvore de elementos React, sem precisar de DOM. */
function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === 'boolean') return '';
  if (typeof no === 'string' || typeof no === 'number') return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join('');
  if (isValidElement(no)) {
    const props = no.props as { children?: ReactNode };
    return textoDe(props.children);
  }
  return '';
}

describe('ficha do cliente', () => {
  const tzOriginal = process.env.TZ;
  // O servidor da Vercel roda em UTC: é aí que a data sem fuso sai errada.
  beforeAll(() => {
    process.env.TZ = 'UTC';
  });
  afterAll(() => {
    process.env.TZ = tzOriginal;
  });

  it('mostra o horário no fuso da barbearia e o status em pt-BR', async () => {
    await withTestDb(async (db) => {
      const [loja] = await db
        .insert(barbershop)
        .values({
          slug: 'ficha-cliente',
          name: 'Barbearia Teste',
          timeZone: 'America/Sao_Paulo',
          minLeadMinutes: 0,
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
      await db
        .insert(staffService)
        .values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
      await db.insert(workingHours).values({
        barbershopId: loja.id,
        staffId: joao.id,
        weekday: 1,
        startTime: '09:00:00',
        endTime: '11:00:00',
      });

      await createAppointment(db, {
        barbershopId: loja.id,
        serviceId: corte.id,
        staffId: joao.id,
        // 09:00 em São Paulo, 12:00 em UTC.
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Cliente Um', phone: '11999998888' },
        origin: 'PANEL',
      });

      const [cliente] = await db
        .select({ id: customer.id })
        .from(customer)
        .where(eq(customer.barbershopId, loja.id));

      const sessao: PanelSession = {
        userId: 'u1',
        barbershopId: loja.id,
        staffId: joao.id,
        role: 'OWNER',
      };
      vi.mocked(requireSession).mockResolvedValue(sessao);

      const elemento = await CustomerDetailPage({
        params: Promise.resolve({ customerId: cliente.id }),
      });
      const texto = textoDe(elemento);

      expect(texto).toContain('Cliente Um');
      expect(texto).toContain('09:00');
      expect(texto).not.toContain('12:00');
      expect(texto).toContain('07/09/2026');
      expect(texto).toContain('Agendado');
      expect(texto).not.toContain('BOOKED');
    });
  });
});
