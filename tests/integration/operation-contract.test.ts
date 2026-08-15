import { describe, it, expect } from 'vitest';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, service, staff, appointment, customer } from '@/db/schema';
import { GET as catalogGet } from '@/app/api/operation-candidates/catalog/route';
import { POST as resolvePost } from '@/app/api/operation-candidates/resolve/route';
import { POST as authorizePost } from '@/app/api/operation-candidates/authorize/route';
import { POST as executePost } from '@/app/api/external-actions/execute/route';

/**
 * Contrato real dos 4 endpoints que o brain (`interpreter-orchestrator`)
 * chama: paths fixos, header `X-Internal-Api-Key`, tenant por chave (sem
 * slug na URL). Os shapes de `resolve`/`execute` casam com os DTOs Java do
 * lado do brain (`CandidateItem(id, fields, label)` e
 * `ExternalActionResponse(status, code, summary)`, ambos **sem tolerância a
 * campo desconhecido**) — não há schema JSON para eles, então o teste aqui é
 * a própria fonte de verdade da forma.
 */

const CHAVE_LOJA_A = 'chave-interna-loja-a';
const CHAVE_LOJA_B = 'chave-interna-loja-b';

async function semearDuasLojas(db: TestDb) {
  const [lojaA] = await db
    .insert(barbershop)
    .values({ slug: 'loja-a', name: 'Barbearia A', internalApiKey: CHAVE_LOJA_A })
    .returning();
  const [lojaB] = await db
    .insert(barbershop)
    .values({ slug: 'loja-b', name: 'Barbearia B', internalApiKey: CHAVE_LOJA_B })
    .returning();

  const [servicoA] = await db
    .insert(service)
    .values({ barbershopId: lojaA.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(service).values({ barbershopId: lojaB.id, name: 'Barba', durationMinutes: 20, priceCents: 2500 });

  const [barbeiroA] = await db
    .insert(staff)
    .values({ barbershopId: lojaA.id, name: 'João', role: 'OWNER' })
    .returning();

  return { lojaA, lojaB, servicoA, barbeiroA };
}

function req(
  method: string,
  path: string,
  opts: { chave?: string; body?: unknown } = {},
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.chave !== undefined) headers['x-internal-api-key'] = opts.chave;
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

describe('plug do brain — auth por chave', () => {
  it('catalog recusa sem header (401)', async () => {
    await withTestDb(async (db) => {
      await semearDuasLojas(db);
      const res = await catalogGet(req('GET', '/api/operation-candidates/catalog'));
      expect(res.status).toBe(401);
    });
  });

  it('catalog recusa chave que não bate com nenhuma barbearia (401)', async () => {
    await withTestDb(async (db) => {
      await semearDuasLojas(db);
      const res = await catalogGet(req('GET', '/api/operation-candidates/catalog', { chave: 'chave-errada' }));
      expect(res.status).toBe(401);
    });
  });

  it('catalog aceita a chave certa (200) e devolve só os dados daquela loja', async () => {
    await withTestDb(async (db) => {
      await semearDuasLojas(db);
      const res = await catalogGet(req('GET', '/api/operation-candidates/catalog', { chave: CHAVE_LOJA_A }));
      expect(res.status).toBe(200);
      const corpo = await res.json();
      const slotServico = corpo.intentSlots.marcar_horario.find((s: { name: string }) => s.name === 'serviceName');
      expect(slotServico.values).toEqual(['Corte']);
      expect(slotServico.values).not.toContain('Barba');
    });
  });

  it('execute recusa sem header do mesmo jeito que recusa chave errada (401 nos dois)', async () => {
    await withTestDb(async (db) => {
      await semearDuasLojas(db);
      const semHeader = await executePost(
        req('POST', '/api/external-actions/execute', {
          body: { actionName: 'x', idempotencyKey: 'k', accountId: 'loja-a', payload: {} },
        }),
      );
      const chaveErrada = await executePost(
        req('POST', '/api/external-actions/execute', {
          chave: 'chave-errada',
          body: { actionName: 'x', idempotencyKey: 'k', accountId: 'loja-a', payload: {} },
        }),
      );
      expect(semHeader.status).toBe(401);
      expect(chaveErrada.status).toBe(401);
    });
  });
});

describe('catalog-response — shape', () => {
  it('traz operations e intentSlots com confirmationTemplate por operação', async () => {
    await withTestDb(async (db) => {
      await semearDuasLojas(db);
      const res = await catalogGet(req('GET', '/api/operation-candidates/catalog', { chave: CHAVE_LOJA_A }));
      const corpo = await res.json();
      expect(corpo.operations).toEqual(expect.arrayContaining(['marcar_horario', 'cancelar_horario']));
      expect(corpo.copyHintsByOperation.marcar_horario.confirmationTemplate).toMatch(/\{serviceName\}/);
    });
  });
});

describe('resolve — shape casa com CandidateItem(id, fields, label) do brain', () => {
  it('devolve candidates como [{id, fields, label}], sem "value" solto', async () => {
    await withTestDb(async (db) => {
      const { lojaA } = await semearDuasLojas(db);
      const res = await resolvePost(
        req('POST', '/api/operation-candidates/resolve', {
          chave: CHAVE_LOJA_A,
          body: { accountId: lojaA.slug, slotToResolve: 'serviceName', resolverKey: 'session', slots: {} },
        }),
      );
      expect(res.status).toBe(200);
      const corpo = await res.json();
      expect(corpo.candidates).toHaveLength(1);
      const [candidato] = corpo.candidates;
      expect(candidato.id).toBe('Corte');
      expect(typeof candidato.fields).toBe('object');
      expect(candidato.fields.serviceId).toBeTruthy();
      expect(candidato).not.toHaveProperty('value');
      expect(candidato).not.toHaveProperty('serviceId');
    });
  });

  it('a chave decide o tenant: accountId divergente no corpo não muda a loja', async () => {
    await withTestDb(async (db) => {
      const { lojaA, lojaB } = await semearDuasLojas(db);
      expect(lojaA.id).not.toBe(lojaB.id);
      const res = await resolvePost(
        req('POST', '/api/operation-candidates/resolve', {
          chave: CHAVE_LOJA_A,
          // accountId de outra loja no corpo: opaco e informativo. A chave (de lojaA)
          // é a autoridade — os candidatos têm de ser os de lojaA ('Corte'), não os
          // de lojaB ('Barba').
          body: { accountId: lojaB.slug, slotToResolve: 'serviceName', resolverKey: 'session', slots: {} },
        }),
      );
      expect(res.status).toBe(200);
      const corpo = await res.json();
      expect(corpo.candidates.map((c: { id: string }) => c.id)).toEqual(['Corte']);
    });
  });
});

describe('authorize — shape {allowed, message}', () => {
  it('autoriza o cancelamento de um agendamento existente', async () => {
    await withTestDb(async (db) => {
      const { lojaA, barbeiroA } = await semearDuasLojas(db);
      const [cliente] = await db
        .insert(customer)
        .values({ barbershopId: lojaA.id, name: 'Bruno', phone: '11999998888' })
        .returning();
      const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const fim = new Date(inicio.getTime() + 30 * 60 * 1000);
      const [marcado] = await db
        .insert(appointment)
        .values({
          barbershopId: lojaA.id,
          staffId: barbeiroA.id,
          customerId: cliente.id,
          serviceNameSnapshot: 'Corte',
          servicePriceCentsSnapshot: 4000,
          serviceDurationMinutesSnapshot: 30,
          startAt: inicio,
          endAt: fim,
          origin: 'PUBLIC',
        })
        .returning();

      const res = await authorizePost(
        req('POST', '/api/operation-candidates/authorize', {
          chave: CHAVE_LOJA_A,
          body: { accountId: lojaA.slug, intent: 'cancelar_horario', slots: { appointmentId: marcado.id } },
        }),
      );
      expect(res.status).toBe(200);
      const corpo = await res.json();
      expect(corpo).toEqual({ allowed: true, message: expect.any(String) });
    });
  });
});

describe('execute — shape {status, code, summary} do ExternalActionResponse', () => {
  it('cancela e devolve status SUCCEEDED, sem campo fora do contrato', async () => {
    await withTestDb(async (db) => {
      const { lojaA, barbeiroA } = await semearDuasLojas(db);
      const [cliente] = await db
        .insert(customer)
        .values({ barbershopId: lojaA.id, name: 'Bruno', phone: '11999998888' })
        .returning();
      const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const fim = new Date(inicio.getTime() + 30 * 60 * 1000);
      const [marcado] = await db
        .insert(appointment)
        .values({
          barbershopId: lojaA.id,
          staffId: barbeiroA.id,
          customerId: cliente.id,
          serviceNameSnapshot: 'Corte',
          servicePriceCentsSnapshot: 4000,
          serviceDurationMinutesSnapshot: 30,
          startAt: inicio,
          endAt: fim,
          origin: 'PUBLIC',
        })
        .returning();

      const res = await executePost(
        req('POST', '/api/external-actions/execute', {
          chave: CHAVE_LOJA_A,
          body: {
            accountId: lojaA.slug,
            actionName: 'cancelar_horario',
            idempotencyKey: 'idem-1',
            externalReference: marcado.id,
            payload: { appointmentId: marcado.id },
          },
        }),
      );
      expect(res.status).toBe(200);
      const corpo = await res.json();
      expect(corpo.status).toBe('SUCCEEDED');
      // O ExternalActionResponse do brain não tolera campo desconhecido: nada
      // de actionName/idempotencyKey/appointmentId soltos na resposta.
      expect(Object.keys(corpo).sort()).toEqual(['code', 'status', 'summary']);
    });
  });

  it('rejeita ação desconhecida com status REJECTED e 400', async () => {
    await withTestDb(async (db) => {
      const { lojaA } = await semearDuasLojas(db);
      const res = await executePost(
        req('POST', '/api/external-actions/execute', {
          chave: CHAVE_LOJA_A,
          body: { accountId: lojaA.slug, actionName: 'fazer_cafe', idempotencyKey: 'k1', payload: {} },
        }),
      );
      expect(res.status).toBe(400);
      const corpo = await res.json();
      expect(corpo.status).toBe('REJECTED');
      expect(corpo.code).toBe('UNKNOWN_ACTION');
    });
  });
});
