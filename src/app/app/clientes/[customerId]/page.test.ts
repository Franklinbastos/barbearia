import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { withTestDb } from '../../../../../tests/helpers/db';
import { barbershop, staff, service, staffService, workingHours, customer } from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import type { PanelSession } from '@/lib/session';

vi.mock('@/lib/session', () => ({ requireSession: vi.fn() }));

import { requireSession } from '@/lib/session';
import CustomerDetailPage from './page';
import { AnonymizeButton } from './anonymize-button';
import { Historico, type HistoricoProps } from './historico';
import { IndicadoresDoCliente, type IndicadoresDoClienteProps } from './indicadores-do-cliente';

/**
 * Concatena o texto de uma árvore de elementos React, sem precisar de DOM.
 *
 * `titulo` e `descricao` entram junto porque o `<CabecalhoDePagina>` recebe o
 * nome e o telefone do cliente por prop, não por filho — sem isso a ficha
 * pareceria vazia para este teste sem estar vazia na tela.
 */
function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === 'boolean') return '';
  if (typeof no === 'string' || typeof no === 'number') return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join('');
  if (isValidElement(no)) {
    const props = no.props as { children?: ReactNode; titulo?: ReactNode; descricao?: ReactNode };
    return [props.titulo, props.descricao, props.children].map(textoDe).join(' ');
  }
  return '';
}

/**
 * O primeiro elemento de um dado componente na árvore, com as props que a
 * página entregou a ele.
 *
 * Existe desde que o histórico virou client component (14/08/2026): ele formata
 * data, hora e status na tela do navegador, e este arquivo roda em Node, sem
 * DOM. **A checagem de fuso não sumiu, mudou de casa** — `historico.test.tsx` e
 * `indicadores-do-cliente.test.tsx` renderizam de verdade, com `TZ=UTC`, e
 * cobrem "09:00 em São Paulo, 12:00 em UTC". O que sobra aqui é o que só um
 * teste com banco pode provar: que a página passa adiante o fuso da loja e as
 * linhas que vieram do Postgres.
 */
function acharComponente<P>(no: ReactNode, tipo: unknown): ReactElement<P> | null {
  if (Array.isArray(no)) {
    for (const filho of no) {
      const achado = acharComponente<P>(filho, tipo);
      if (achado) return achado;
    }
    return null;
  }
  if (!isValidElement(no)) return null;
  if (no.type === tipo) return no as ReactElement<P>;
  return acharComponente<P>((no.props as { children?: ReactNode }).children, tipo);
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

  it('entrega o fuso da loja e o histórico do banco a quem desenha a ficha', async () => {
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
      // Um agendamento e nenhuma visita: o selo é "Cliente novo", e ele é um só.
      expect(texto).toContain('Cliente novo');
      expect(texto).not.toContain('Sumido');

      const historico = acharComponente<HistoricoProps>(elemento, Historico);
      expect(historico).not.toBeNull();
      expect(historico!.props.timeZone).toBe('America/Sao_Paulo');
      expect(historico!.props.atendimentos).toHaveLength(1);
      expect(historico!.props.atendimentos[0].status).toBe('BOOKED');
      expect(historico!.props.atendimentos[0].startAt.toISOString()).toBe(
        '2026-09-07T12:00:00.000Z',
      );

      const indicadores = acharComponente<IndicadoresDoClienteProps>(
        elemento,
        IndicadoresDoCliente,
      );
      expect(indicadores).not.toBeNull();
      expect(indicadores!.props.timeZone).toBe('America/Sao_Paulo');
      // Agendado não é dinheiro nem base de falta: traço, nunca zero por cento.
      expect(indicadores!.props.perfil.atendimentos).toBe(0);
      expect(indicadores!.props.perfil.totalGastoCents).toBe(0);
      expect(indicadores!.props.perfil.taxaDeFalta).toBeNull();

      // A confirmação de anonimizar nomeia o cliente, e o nome vem daqui.
      const remover = acharComponente<{ nome: string }>(elemento, AnonymizeButton);
      expect(remover?.props.nome).toBe('Cliente Um');
    });
  });
});
