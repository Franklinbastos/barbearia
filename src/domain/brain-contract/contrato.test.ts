import { describe, it, expect, vi, beforeEach } from 'vitest';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';

/**
 * Teste de contrato: valida que as respostas da casca casam com os schemas
 * versionados do brain (cópia fiel em `./schemas/`, fonte da verdade).
 *
 * O ajv disponível é draft-07; os schemas declaram draft-2020-12, mas só usam
 * construções que os dois têm em comum (union de tipos, enum, pattern,
 * additionalProperties). Tiramos o `$schema` antes de compilar para o ajv não
 * procurar um meta-schema que ele não conhece — verificado caso a caso.
 */
vi.mock('@/domain/booking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domain/booking')>()),
  getAvailability: vi.fn(),
}));
vi.mock('@/db/repositories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/repositories')>()),
  findAppointmentById: vi.fn(),
}));

import { getAvailability } from '@/domain/booking';
import { montarCatalogo } from './catalogo';
import { autorizar } from './autorizar';
import type { LojaDoBrain, ServicoDoBrain, BarbeiroDoBrain } from './tipos';

const SCHEMAS = [
  'catalog-response.schema.json',
  'authorize-request.schema.json',
  'authorize-response.schema.json',
  'resolve-candidates-request.schema.json',
  'external-action-execute-request.schema.json',
  'action-result-request.schema.json',
];

function lerSchema(nome: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`./schemas/${nome}`, import.meta.url), 'utf8'));
}

function compilar(nome: string) {
  const { $schema: _schema, ...resto } = lerSchema(nome);
  return new Ajv({ allErrors: true }).compile(resto);
}

const loja: LojaDoBrain = {
  id: 'loja-1',
  slug: 'barbearia-teste',
  name: 'Barbearia do Zé',
  timeZone: 'America/Sao_Paulo',
  maxAdvanceDays: 30,
};
const servicos: ServicoDoBrain[] = [
  { id: 's1', name: 'Corte', durationMinutes: 30, priceCents: 4000 },
  { id: 's2', name: 'Barba', durationMinutes: 20, priceCents: 2500 },
];
const equipe: BarbeiroDoBrain[] = [{ id: 'b1', name: 'João' }];

const disponivel = vi.mocked(getAvailability);
beforeEach(() => disponivel.mockReset());

describe('schemas copiados do contrato', () => {
  it('todos são JSON Schema bem-formado', () => {
    for (const nome of SCHEMAS) {
      expect(() => compilar(nome), nome).not.toThrow();
    }
  });
});

describe('resposta do catalog casa com catalog-response.schema.json', () => {
  const validar = compilar('catalog-response.schema.json');

  it('valida o catálogo montado da barbearia', () => {
    const catalogo = montarCatalogo(loja, servicos, equipe);
    const ok = validar(catalogo);
    expect(validar.errors ?? [], JSON.stringify(validar.errors)).toEqual([]);
    expect(ok).toBe(true);
  });

  it('o validador de fato reprova um catálogo sem operations', () => {
    const validarNeg = compilar('catalog-response.schema.json');
    expect(validarNeg({ intentSlots: {}, uxHints: null })).toBe(false);
  });
});

describe('resposta do authorize casa com authorize-response.schema.json', () => {
  const validar = compilar('authorize-response.schema.json');

  it('valida a resposta que libera', async () => {
    disponivel.mockResolvedValue([
      { staffId: 'b1', staffName: 'João', start: new Date('2026-08-20T12:00:00Z'), end: new Date('2026-08-20T12:30:00Z'), durationMinutes: 30 },
    ]);
    const r = await autorizar(db(), loja, servicos, equipe, {
      intent: 'marcar_horario',
      slots: { serviceName: 'Corte', sessionDate: '2026-08-20', sessionTime: '09:00' },
    }, new Date('2026-08-19T10:00:00Z'));
    expect(validar(r)).toBe(true);
  });

  it('valida a resposta que recusa (message pode ser string)', async () => {
    const r = await autorizar(db(), loja, servicos, equipe, {
      intent: 'marcar_horario',
      slots: { serviceName: 'Sobrancelha', sessionDate: '2026-08-20', sessionTime: '09:00' },
    }, new Date('2026-08-19T10:00:00Z'));
    expect(r.allowed).toBe(false);
    expect(validar(r)).toBe(true);
  });

  it('reprova resposta sem allowed', () => {
    expect(validar({ message: 'oi' })).toBe(false);
  });
});

describe('requisições que a casca aceita casam com os schemas de request', () => {
  it('um authorize-request típico é válido', () => {
    const validar = compilar('authorize-request.schema.json');
    const req = {
      accountId: 'barbearia-teste',
      intent: 'marcar_horario',
      slots: { serviceName: 'Corte', sessionDate: '2026-08-20', sessionTime: '09:00' },
    };
    expect(validar(req)).toBe(true);
  });

  it('um resolve-candidates-request típico é válido', () => {
    const validar = compilar('resolve-candidates-request.schema.json');
    const req = {
      accountId: 'barbearia-teste',
      slotToResolve: 'sessionTime',
      resolverKey: 'session',
      slots: { serviceName: 'Corte', sessionDate: '2026-08-20' },
    };
    expect(validar(req)).toBe(true);
  });
});

describe('external-action-execute-request.schema.json — envelope do contrato', () => {
  const validar = compilar('external-action-execute-request.schema.json');

  it('valida um request no formato Tempra (prova que o schema copiado está íntegro)', () => {
    const req = {
      actionName: 'create_session_with_enrollment',
      accountId: 'barbearia-teste',
      idempotencyKey: 'k1',
      externalReference: 'ref-1',
      payload: { clientName: 'Bruno', serviceName: 'Corte', sessionDate: '2026-08-20', sessionTime: '09:00' },
    };
    expect(validar(req)).toBe(true);
  });

  it('o actionName da barbearia NÃO está no enum Tempra: o domínio externo declara as próprias operações no catalog', () => {
    const req = {
      actionName: 'marcar_horario',
      accountId: 'barbearia-teste',
      idempotencyKey: 'k1',
      externalReference: 'ref-1',
      payload: {},
    };
    expect(validar(req)).toBe(false);
  });

  it('o envelope obrigatório do execute é o que o handler exige', () => {
    const schema = lerSchema('external-action-execute-request.schema.json');
    expect(schema.required).toEqual(
      expect.arrayContaining(['actionName', 'externalReference', 'idempotencyKey', 'payload', 'accountId']),
    );
  });
});

/** Db falso: as funções de domínio estão mockadas, então ele nunca é tocado. */
function db() {
  return {} as unknown as import('@/db/repositories').Db;
}
