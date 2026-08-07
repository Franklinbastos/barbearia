import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

/**
 * Sessão falsa do painel: o `requireSession` de verdade roda contra o banco de
 * teste, só o Better-Auth é substituído. Assim o teste cobre a resolução do
 * vínculo (barbearia + papel) além da regra de cada action.
 */
const sessaoFalsa = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => (sessaoFalsa.userId ? { user: { id: sessaoFalsa.userId } } : null),
    },
  },
}));

import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, timeOff, workingHours } from '@/db/schema';
import { closeDb } from '@/db/client';
import { createStaffAction, toggleStaffAction } from '@/app/app/equipe/actions';

const ESTADO_INICIAL = {};

beforeEach(() => {
  sessaoFalsa.userId = null;
});

afterAll(async () => {
  await closeDb();
});

/**
 * Código de erro do `redirect` usado pelas actions sem formulário (botões de
 * toggle). Vai código, não frase: a querystring é editável e mensagem livre ali
 * deixaria escrever texto arbitrário dentro do painel autenticado.
 */
function codigoDoRedirect(erro: unknown): string | null {
  const digest = (erro as { digest?: unknown } | null)?.digest;
  if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT')) return null;
  const url = digest.split(';').slice(2, -2).join(';');
  return new URL(url, 'http://x').searchParams.get('erro');
}

async function capturar(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return null;
  } catch (erro) {
    return erro;
  }
}

async function semear(db: TestDb) {
  const [loja] = await db.insert(barbershop).values({ slug: 'teste-b', name: 'Teste' }).returning();
  const [dono] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Dono', role: 'OWNER', userId: 'u-dono' })
    .returning();
  const [barbeiro] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Barbeiro', role: 'BARBER', userId: 'u-barbeiro' })
    .returning();
  return { loja, dono, barbeiro };
}

async function ativo(db: TestDb, staffId: string): Promise<boolean> {
  const [linha] = await db.select().from(staff).where(eq(staff.id, staffId));
  return linha.active;
}

describe('toggleStaffAction — achado 3', () => {
  it('recusa desativar o único dono ativo da barbearia', async () => {
    await withTestDb(async (db) => {
      const { dono } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      const erro = await capturar(() => toggleStaffAction(dono.id, false));

      expect(codigoDoRedirect(erro)).toBe('ULTIMO_DONO');
      expect(await ativo(db, dono.id)).toBe(true);
    });
  });

  it('recusa o usuário desativar o próprio acesso mesmo com outro dono ativo', async () => {
    await withTestDb(async (db) => {
      const { loja, dono } = await semear(db);
      await db.insert(staff).values({ barbershopId: loja.id, name: 'Sócia', role: 'OWNER' });
      sessaoFalsa.userId = 'u-dono';

      const erro = await capturar(() => toggleStaffAction(dono.id, false));

      expect(codigoDoRedirect(erro)).toBe('NAO_PODE_DESATIVAR_A_SI');
      expect(await ativo(db, dono.id)).toBe(true);
    });
  });

  it('deixa o dono desativar outro membro da equipe', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      await toggleStaffAction(barbeiro.id, false);

      expect(await ativo(db, barbeiro.id)).toBe(false);
    });
  });

  it('não deixa desativar membro de outra barbearia', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      const [outra] = await db.insert(barbershop).values({ slug: 'outra-b', name: 'Outra' }).returning();
      const [alheio] = await db
        .insert(staff)
        .values({ barbershopId: outra.id, name: 'Alheio', role: 'BARBER' })
        .returning();
      sessaoFalsa.userId = 'u-dono';

      await capturar(() => toggleStaffAction(alheio.id, false));

      expect(await ativo(db, alheio.id)).toBe(true);
    });
  });
});

describe('papel BARBER no painel — achado 3b', () => {
  it('recusa o barbeiro desativar alguém da equipe', async () => {
    await withTestDb(async (db) => {
      const { dono } = await semear(db);
      sessaoFalsa.userId = 'u-barbeiro';

      const erro = await capturar(() => toggleStaffAction(dono.id, false));

      expect(codigoDoRedirect(erro)).toBe('SEM_PERMISSAO');
      expect(await ativo(db, dono.id)).toBe(true);
    });
  });

  it('recusa o barbeiro cadastrar novo membro na equipe', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      sessaoFalsa.userId = 'u-barbeiro';

      const form = new FormData();
      form.set('name', 'Intruso');
      const estado = await createStaffAction(ESTADO_INICIAL, form);

      expect(estado.erro).toMatch(/dono/i);
      const equipe = await db.select().from(staff);
      expect(equipe.map((m) => m.name)).not.toContain('Intruso');
    });
  });

  it('deixa o dono cadastrar novo membro na equipe', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      sessaoFalsa.userId = 'u-dono';

      const form = new FormData();
      form.set('name', 'Novo Barbeiro');
      const estado = await createStaffAction(ESTADO_INICIAL, form);

      expect(estado.ok).toBe(true);
      const equipe = await db.select().from(staff);
      expect(equipe.map((m) => m.name)).toContain('Novo Barbeiro');
    });
  });
});

describe('serviços e preço são do dono — achado 3b', () => {
  async function servicoDaCasa(db: TestDb, barbershopId: string) {
    const [corte] = await db
      .insert(service)
      .values({ barbershopId, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
      .returning();
    return corte;
  }

  it('recusa o barbeiro cadastrar serviço', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      sessaoFalsa.userId = 'u-barbeiro';
      const { saveServiceAction } = await import('@/app/app/servicos/actions');

      const form = new FormData();
      form.set('name', 'Progressiva');
      form.set('durationMinutes', '60');
      form.set('priceCents', '15000');
      const estado = await saveServiceAction(ESTADO_INICIAL, form);

      expect(estado.erro).toMatch(/dono/i);
      expect(await db.select().from(service)).toHaveLength(0);
    });
  });

  it('recusa o barbeiro mudar o preço de um serviço', async () => {
    await withTestDb(async (db) => {
      const { loja } = await semear(db);
      const corte = await servicoDaCasa(db, loja.id);
      sessaoFalsa.userId = 'u-barbeiro';
      const { saveServiceAction } = await import('@/app/app/servicos/actions');

      const form = new FormData();
      form.set('id', corte.id);
      form.set('name', 'Corte');
      form.set('durationMinutes', '30');
      form.set('priceCents', '1');
      const estado = await saveServiceAction(ESTADO_INICIAL, form);

      expect(estado.erro).toMatch(/dono/i);
      const [depois] = await db.select().from(service).where(eq(service.id, corte.id));
      expect(depois.priceCents).toBe(4000);
    });
  });

  it('recusa o barbeiro desativar um serviço', async () => {
    await withTestDb(async (db) => {
      const { loja } = await semear(db);
      const corte = await servicoDaCasa(db, loja.id);
      sessaoFalsa.userId = 'u-barbeiro';
      const { toggleServiceAction } = await import('@/app/app/servicos/actions');

      const estado = await toggleServiceAction(corte.id, false);

      expect(estado?.erro).toMatch(/dono/i);
      const [depois] = await db.select().from(service).where(eq(service.id, corte.id));
      expect(depois.active).toBe(true);
    });
  });

  it('deixa o dono desativar um serviço', async () => {
    await withTestDb(async (db) => {
      const { loja } = await semear(db);
      const corte = await servicoDaCasa(db, loja.id);
      sessaoFalsa.userId = 'u-dono';
      const { toggleServiceAction } = await import('@/app/app/servicos/actions');

      expect(await toggleServiceAction(corte.id, false)).toBeUndefined();
      const [depois] = await db.select().from(service).where(eq(service.id, corte.id));
      expect(depois.active).toBe(false);
    });
  });

  it('recusa o barbeiro mudar as configurações da barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja } = await semear(db);
      sessaoFalsa.userId = 'u-barbeiro';
      const { saveSettingsAction } = await import('@/app/app/configuracoes/actions');

      const form = new FormData();
      form.set('name', 'Nome Novo');
      form.set('slotMinutes', '60');
      form.set('minLeadMinutes', '0');
      form.set('maxAdvanceDays', '30');
      form.set('timeZone', 'America/Sao_Paulo');
      const estado = await saveSettingsAction(ESTADO_INICIAL, form);

      expect(estado.erro).toMatch(/dono/i);
      const [depois] = await db.select().from(barbershop).where(eq(barbershop.id, loja.id));
      expect(depois.name).toBe('Teste');
    });
  });

  it('recusa o barbeiro criar bloqueio na agenda de outro barbeiro', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-barbeiro';
      const { createTimeOffAction } = await import('@/app/app/equipe/[staffId]/actions');

      const form = new FormData();
      form.set('date', '2026-09-10');
      form.set('startTime', '10:00');
      form.set('endTime', '12:00');
      const estado = await createTimeOffAction(barbeiro.id, ESTADO_INICIAL, form);

      expect(estado.erro).toMatch(/dono/i);
      expect(await db.select().from(timeOff)).toHaveLength(0);
    });
  });

  it('recusa o barbeiro mexer no expediente da equipe', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-barbeiro';
      const { saveWorkingHoursAction } = await import('@/app/app/equipe/[staffId]/actions');

      const form = new FormData();
      form.set('weekday', '1');
      form.set('block1_start', '08:00');
      form.set('block1_end', '20:00');
      const estado = await saveWorkingHoursAction(barbeiro.id, ESTADO_INICIAL, form);

      expect(estado.erro).toMatch(/dono/i);
      expect(await db.select().from(workingHours)).toHaveLength(0);
    });
  });
});

describe('vínculo do usuário — achado menor (tenant não determinístico)', () => {
  it('escolhe sempre o mesmo vínculo quando o usuário está em duas barbearias', async () => {
    await withTestDb(async (db) => {
      const [primeira] = await db
        .insert(barbershop)
        .values({ slug: 'primeira-b', name: 'Primeira' })
        .returning();
      const [segunda] = await db
        .insert(barbershop)
        .values({ slug: 'segunda-b', name: 'Segunda' })
        .returning();
      const [vinculoAntigo] = await db
        .insert(staff)
        .values({
          barbershopId: primeira.id,
          name: 'Dono',
          role: 'OWNER',
          userId: 'u-duplo',
          createdAt: new Date('2026-01-01T10:00:00Z'),
        })
        .returning();
      await db.insert(staff).values({
        barbershopId: segunda.id,
        name: 'Barbeiro',
        role: 'BARBER',
        userId: 'u-duplo',
        createdAt: new Date('2026-02-01T10:00:00Z'),
      });

      // Um UPDATE reescreve a linha no fim do heap: sem ORDER BY, o LIMIT 1
      // passa a devolver a outra barbearia.
      await db.update(staff).set({ name: 'Dono Atualizado' }).where(eq(staff.id, vinculoAntigo.id));

      sessaoFalsa.userId = 'u-duplo';
      const { requireSession } = await import('@/lib/session');
      const escolhas = new Set<string>();
      for (let i = 0; i < 5; i++) escolhas.add((await requireSession()).barbershopId);

      expect([...escolhas]).toEqual([primeira.id]);
    });
  });
});

describe('serviços do barbeiro — achados 7 e 18', () => {
  async function semearServicos(db: TestDb) {
    const base = await semear(db);
    const [corte] = await db
      .insert(service)
      .values({ barbershopId: base.loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
      .returning();
    const [barba] = await db
      .insert(service)
      .values({
        barbershopId: base.loja.id,
        name: 'Barba',
        durationMinutes: 20,
        priceCents: 2000,
        active: false,
      })
      .returning();
    return { ...base, corte, barba };
  }

  it('recusa duração própria igual a zero', async () => {
    await withTestDb(async (db) => {
      const { barbeiro, corte } = await semearServicos(db);
      sessaoFalsa.userId = 'u-dono';
      const { saveStaffServicesAction } = await import('@/app/app/equipe/[staffId]/actions');

      const form = new FormData();
      form.append('serviceIds', corte.id);
      form.set(`duration_${corte.id}`, '0');
      const estado = await saveStaffServicesAction(barbeiro.id, ESTADO_INICIAL, form);

      expect(estado.erro).toMatch(/duração/i);
      const vinculos = await db.select().from(staffService);
      expect(vinculos).toHaveLength(0);
    });
  });

  it('recusa duração própria negativa ou acima de 8 horas', async () => {
    await withTestDb(async (db) => {
      const { barbeiro, corte } = await semearServicos(db);
      sessaoFalsa.userId = 'u-dono';
      const { saveStaffServicesAction } = await import('@/app/app/equipe/[staffId]/actions');

      for (const valor of ['-10', '481', '12,5', 'abc']) {
        const form = new FormData();
        form.append('serviceIds', corte.id);
        form.set(`duration_${corte.id}`, valor);
        const estado = await saveStaffServicesAction(barbeiro.id, ESTADO_INICIAL, form);
        expect(estado.erro, `valor ${valor}`).toMatch(/duração/i);
      }

      expect(await db.select().from(staffService)).toHaveLength(0);
    });
  });

  it('aceita duração própria válida e campo vazio', async () => {
    await withTestDb(async (db) => {
      const { barbeiro, corte } = await semearServicos(db);
      sessaoFalsa.userId = 'u-dono';
      const { saveStaffServicesAction } = await import('@/app/app/equipe/[staffId]/actions');

      const form = new FormData();
      form.append('serviceIds', corte.id);
      form.set(`duration_${corte.id}`, '25');
      expect((await saveStaffServicesAction(barbeiro.id, ESTADO_INICIAL, form)).ok).toBe(true);
      const [comOverride] = await db.select().from(staffService);
      expect(comOverride.durationMinutesOverride).toBe(25);

      const vazio = new FormData();
      vazio.append('serviceIds', corte.id);
      vazio.set(`duration_${corte.id}`, '  ');
      expect((await saveStaffServicesAction(barbeiro.id, ESTADO_INICIAL, vazio)).ok).toBe(true);
      const [semOverride] = await db.select().from(staffService);
      expect(semOverride.durationMinutesOverride).toBeNull();
    });
  });

  it('preserva o vínculo com serviço inativo ao salvar', async () => {
    await withTestDb(async (db) => {
      const { barbeiro, corte, barba, loja } = await semearServicos(db);
      await db.insert(staffService).values([
        { barbershopId: loja.id, staffId: barbeiro.id, serviceId: corte.id },
        { barbershopId: loja.id, staffId: barbeiro.id, serviceId: barba.id, durationMinutesOverride: 15 },
      ]);
      sessaoFalsa.userId = 'u-dono';
      const { saveStaffServicesAction } = await import('@/app/app/equipe/[staffId]/actions');

      const form = new FormData();
      form.append('serviceIds', corte.id);
      form.set(`duration_${corte.id}`, '');
      expect((await saveStaffServicesAction(barbeiro.id, ESTADO_INICIAL, form)).ok).toBe(true);

      const vinculos = await db.select().from(staffService).where(eq(staffService.staffId, barbeiro.id));
      const barbaLink = vinculos.find((v) => v.serviceId === barba.id);
      expect(barbaLink, 'o vínculo com o serviço inativo sumiu').toBeDefined();
      expect(barbaLink?.durationMinutesOverride).toBe(15);
    });
  });

  it('recusa o barbeiro salvar os serviços da equipe', async () => {
    await withTestDb(async (db) => {
      const { barbeiro, corte } = await semearServicos(db);
      sessaoFalsa.userId = 'u-barbeiro';
      const { saveStaffServicesAction } = await import('@/app/app/equipe/[staffId]/actions');

      const form = new FormData();
      form.append('serviceIds', corte.id);
      const estado = await saveStaffServicesAction(barbeiro.id, ESTADO_INICIAL, form);

      expect(estado.erro).toMatch(/dono/i);
      expect(await db.select().from(staffService)).toHaveLength(0);
    });
  });
});
