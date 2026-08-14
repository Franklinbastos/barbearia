import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { withTestDb, type TestDb } from '../helpers/db';
import { appointment, barbershop, customer, service, staff, timeOff, workingHours } from '@/db/schema';
import {
  listarAtendimentosDoPeriodo,
  listarExpedienteEBloqueios,
  listarHistoricoDeClientes,
} from '@/db/repositories';

const TZ = 'America/Sao_Paulo';

/** Segunda-feira. A janela padrão dos testes é este dia inteiro. */
const SEGUNDA = '2026-09-07';

function em(dia: string, hora: string): Date {
  return DateTime.fromISO(`${dia}T${hora}`, { zone: TZ }).toJSDate();
}

const INICIO = em(SEGUNDA, '00:00');
const FIM = em('2026-09-08', '00:00');

/**
 * Duas barbearias com a mesma cara — é o que faz o teste de escopo valer
 * alguma coisa. Se a consulta esquecer o `barbershopId`, ela traz o dobro e o
 * dono vê a ocupação do vizinho somada à dele.
 */
async function semear(db: TestDb, slug: string) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug, name: `Loja ${slug}`, timeZone: TZ })
    .returning();
  const [joao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'João', role: 'OWNER' })
    .returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(workingHours).values({
    barbershopId: loja.id,
    staffId: joao.id,
    weekday: 1,
    startTime: '09:00:00',
    endTime: '18:00:00',
  });
  return { loja, joao, corte };
}

async function criarCliente(db: TestDb, barbershopId: string, nome: string, telefone: string) {
  const [linha] = await db
    .insert(customer)
    .values({ barbershopId, name: nome, phone: telefone })
    .returning();
  return linha;
}

async function marcar(
  db: TestDb,
  args: {
    barbershopId: string;
    staffId: string;
    serviceId: string;
    customerId: string;
    startAt: Date;
    minutos?: number;
    status?: 'BOOKED' | 'DONE' | 'CANCELED' | 'NO_SHOW';
    precoCents?: number;
    canceledAt?: Date | null;
  },
) {
  const minutos = args.minutos ?? 30;
  const [linha] = await db
    .insert(appointment)
    .values({
      barbershopId: args.barbershopId,
      staffId: args.staffId,
      customerId: args.customerId,
      serviceId: args.serviceId,
      serviceNameSnapshot: 'Corte',
      servicePriceCentsSnapshot: args.precoCents ?? 4000,
      serviceDurationMinutesSnapshot: minutos,
      startAt: args.startAt,
      endAt: new Date(args.startAt.getTime() + minutos * 60_000),
      status: args.status ?? 'DONE',
      canceledAt: args.canceledAt ?? null,
    })
    .returning();
  return linha;
}

describe('listarExpedienteEBloqueios', () => {
  it('traz o expediente só da barbearia pedida', async () => {
    await withTestDb(async (db) => {
      const minha = await semear(db, 'minha');
      await semear(db, 'vizinha');

      const { expediente } = await listarExpedienteEBloqueios(db, minha.loja.id, INICIO, FIM);

      expect(expediente).toHaveLength(1);
      expect(expediente[0]).toMatchObject({
        staffId: minha.joao.id,
        weekday: 1,
        startTime: '09:00:00',
        endTime: '18:00:00',
      });
    });
  });

  it('traz os bloqueios só da barbearia pedida', async () => {
    await withTestDb(async (db) => {
      const minha = await semear(db, 'minha');
      const vizinha = await semear(db, 'vizinha');

      await db.insert(timeOff).values({
        barbershopId: vizinha.loja.id,
        staffId: vizinha.joao.id,
        startAt: em(SEGUNDA, '10:00'),
        endAt: em(SEGUNDA, '11:00'),
      });

      const { bloqueios } = await listarExpedienteEBloqueios(db, minha.loja.id, INICIO, FIM);
      expect(bloqueios).toHaveLength(0);
    });
  });

  it('traz só os bloqueios que intersectam a janela', async () => {
    await withTestDb(async (db) => {
      const { loja, joao } = await semear(db, 'minha');

      await db.insert(timeOff).values([
        // Dentro: almoço da segunda.
        { barbershopId: loja.id, staffId: joao.id, startAt: em(SEGUNDA, '12:00'), endAt: em(SEGUNDA, '13:00'), reason: 'almoço' },
        // Encosta pelas duas pontas: entra pela parte de dentro.
        { barbershopId: loja.id, staffId: joao.id, startAt: em('2026-09-06', '22:00'), endAt: em(SEGUNDA, '09:30'), reason: 'madrugada' },
        // Fora, antes: termina exatamente na meia-noite da janela.
        { barbershopId: loja.id, staffId: joao.id, startAt: em('2026-09-06', '20:00'), endAt: INICIO, reason: 'véspera' },
        // Fora, depois: começa exatamente no fim da janela.
        { barbershopId: loja.id, staffId: joao.id, startAt: FIM, endAt: em('2026-09-08', '10:00'), reason: 'terça' },
      ]);

      const { bloqueios } = await listarExpedienteEBloqueios(db, loja.id, INICIO, FIM);

      expect(bloqueios).toHaveLength(2);
      expect(bloqueios.map((b) => b.startAt.getTime()).sort()).toEqual(
        [em('2026-09-06', '22:00').getTime(), em(SEGUNDA, '12:00').getTime()].sort(),
      );
    });
  });

  it('ignora o expediente de barbeiro desativado — cadeira que não existe mais não é hora vaga', async () => {
    await withTestDb(async (db) => {
      const { loja } = await semear(db, 'minha');
      const [saiu] = await db
        .insert(staff)
        .values({ barbershopId: loja.id, name: 'Saiu', active: false })
        .returning();
      await db.insert(workingHours).values({
        barbershopId: loja.id,
        staffId: saiu.id,
        weekday: 1,
        startTime: '09:00:00',
        endTime: '18:00:00',
      });

      const { expediente } = await listarExpedienteEBloqueios(db, loja.id, INICIO, FIM);
      expect(expediente.map((b) => b.staffId)).not.toContain(saiu.id);
    });
  });
});

describe('listarHistoricoDeClientes', () => {
  it('devolve as visitas de cada cliente em ordem, só da barbearia pedida', async () => {
    await withTestDb(async (db) => {
      const minha = await semear(db, 'minha');
      const vizinha = await semear(db, 'vizinha');

      const meu = await criarCliente(db, minha.loja.id, 'Meu Cliente', '11999990001');
      const dele = await criarCliente(db, vizinha.loja.id, 'Cliente do Vizinho', '11999990002');

      // Inseridos fora de ordem de propósito: quem ordena é a consulta.
      await marcar(db, { barbershopId: minha.loja.id, staffId: minha.joao.id, serviceId: minha.corte.id, customerId: meu.id, startAt: em('2026-08-24', '10:00') });
      await marcar(db, { barbershopId: minha.loja.id, staffId: minha.joao.id, serviceId: minha.corte.id, customerId: meu.id, startAt: em('2026-08-10', '10:00') });
      await marcar(db, { barbershopId: vizinha.loja.id, staffId: vizinha.joao.id, serviceId: vizinha.corte.id, customerId: dele.id, startAt: em('2026-08-11', '10:00') });

      const historico = await listarHistoricoDeClientes(db, minha.loja.id, em('2026-01-01', '00:00'));

      expect(historico).toHaveLength(1);
      expect(historico[0]).toMatchObject({ customerId: meu.id, nome: 'Meu Cliente', telefone: '11999990001' });
      expect(historico[0].visitas.map((v) => v.getTime())).toEqual([
        em('2026-08-10', '10:00').getTime(),
        em('2026-08-24', '10:00').getTime(),
      ]);
    });
  });

  it('conta só o que foi atendido, e só a partir do `desde`', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, 'minha');
      const cliente = await criarCliente(db, loja.id, 'Cliente', '11999990003');

      await marcar(db, { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id, customerId: cliente.id, startAt: em('2026-08-10', '10:00') });
      await marcar(db, { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id, customerId: cliente.id, startAt: em('2026-08-17', '10:00'), status: 'NO_SHOW' });
      await marcar(db, { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id, customerId: cliente.id, startAt: em('2026-08-24', '10:00'), status: 'CANCELED' });
      await marcar(db, { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id, customerId: cliente.id, startAt: em('2025-08-10', '10:00') });

      const historico = await listarHistoricoDeClientes(db, loja.id, em('2026-01-01', '00:00'));

      expect(historico[0].visitas.map((v) => v.getTime())).toEqual([em('2026-08-10', '10:00').getTime()]);
    });
  });
});

describe('listarAtendimentosDoPeriodo', () => {
  it('traz só a barbearia pedida, com o preço do snapshot e o `canceledAt`', async () => {
    await withTestDb(async (db) => {
      const minha = await semear(db, 'minha');
      const vizinha = await semear(db, 'vizinha');

      const meu = await criarCliente(db, minha.loja.id, 'Meu Cliente', '11999990001');
      const dele = await criarCliente(db, vizinha.loja.id, 'Cliente do Vizinho', '11999990002');

      await marcar(db, { barbershopId: minha.loja.id, staffId: minha.joao.id, serviceId: minha.corte.id, customerId: meu.id, startAt: em(SEGUNDA, '10:00'), precoCents: 5500, status: 'CANCELED', canceledAt: em(SEGUNDA, '09:00') });
      await marcar(db, { barbershopId: vizinha.loja.id, staffId: vizinha.joao.id, serviceId: vizinha.corte.id, customerId: dele.id, startAt: em(SEGUNDA, '10:00') });

      const itens = await listarAtendimentosDoPeriodo(db, minha.loja.id, INICIO, FIM);

      expect(itens).toHaveLength(1);
      expect(itens[0]).toMatchObject({
        staffId: minha.joao.id,
        customerId: meu.id,
        status: 'CANCELED',
        precoCents: 5500,
      });
      expect(itens[0].canceledAt?.getTime()).toBe(em(SEGUNDA, '09:00').getTime());
    });
  });

  it('deixa de fora o que não toca a janela', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, 'minha');
      const cliente = await criarCliente(db, loja.id, 'Cliente', '11999990003');

      await marcar(db, { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id, customerId: cliente.id, startAt: em(SEGUNDA, '10:00') });
      await marcar(db, { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id, customerId: cliente.id, startAt: em('2026-09-08', '10:00') });

      const itens = await listarAtendimentosDoPeriodo(db, loja.id, INICIO, FIM);
      expect(itens).toHaveLength(1);
      expect(itens[0].startAt.getTime()).toBe(em(SEGUNDA, '10:00').getTime());
    });
  });
});
