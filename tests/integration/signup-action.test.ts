import { describe, it, expect, vi, afterAll } from 'vitest';

/**
 * O `createBarbershopForUser` real roda contra o banco de teste; o mock só é
 * ligado no caso que precisa simular falha de infraestrutura depois que a conta
 * já existe.
 */
const falhaAoCriarBarbearia = vi.hoisted(() => ({ mensagem: null as string | null }));

vi.mock('@/domain/onboarding/create-barbershop', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/domain/onboarding/create-barbershop')>();
  return {
    ...original,
    createBarbershopForUser: async (...args: Parameters<typeof original.createBarbershopForUser>) => {
      if (falhaAoCriarBarbearia.mensagem) throw new Error(falhaAoCriarBarbearia.mensagem);
      return original.createBarbershopForUser(...args);
    },
  };
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, session, staff, user } from '@/db/schema';
import { closeDb } from '@/db/client';
import { auth } from '@/lib/auth';
import { signupAction } from '@/app/signup/actions';

const ESTADO_INICIAL = {};

afterAll(async () => {
  await closeDb();
});

function formulario(sobrescreve: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    ownerName: 'Zé Barbeiro',
    email: 'ze@example.com',
    password: 'senha-bem-longa-123',
    shopName: 'Toca do Zé',
    slug: 'toca-do-ze',
    timeZone: 'America/Sao_Paulo',
    ...sobrescreve,
  };
  const form = new FormData();
  for (const [chave, valor] of Object.entries(base)) form.set(chave, valor);
  return form;
}

/** O sucesso termina em `redirect('/app')`, que lança o erro de controle do Next. */
async function executar(form: FormData): Promise<{ erro?: string; redirecionou: boolean }> {
  try {
    const estado = await signupAction(ESTADO_INICIAL, form);
    return { erro: estado.erro, redirecionou: false };
  } catch (erro) {
    const digest = (erro as { digest?: unknown }).digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
      return { redirecionou: true };
    }
    throw erro;
  }
}

async function contarUsuarios(db: TestDb): Promise<number> {
  return (await db.select().from(user)).length;
}

describe('signupAction — fuso horário (achado 17)', () => {
  it('recusa fuso inválido e não cria conta nem barbearia', async () => {
    await withTestDb(async (db) => {
      falhaAoCriarBarbearia.mensagem = null;

      const resultado = await executar(formulario({ timeZone: 'Marte/Olimpo' }));

      expect(resultado.erro).toMatch(/fuso/i);
      expect(await contarUsuarios(db)).toBe(0);
      expect(await db.select().from(barbershop)).toHaveLength(0);
    });
  });

  it('aceita um fuso válido de verdade', async () => {
    await withTestDb(async (db) => {
      falhaAoCriarBarbearia.mensagem = null;

      const resultado = await executar(formulario({ timeZone: 'America/Manaus' }));

      expect(resultado.redirecionou).toBe(true);
      const [loja] = await db.select().from(barbershop);
      expect(loja.timeZone).toBe('America/Manaus');
    });
  });
});

describe('signupAction — slug antes da conta (achado 17)', () => {
  it('recusa slug reservado sem deixar conta órfã', async () => {
    await withTestDb(async (db) => {
      falhaAoCriarBarbearia.mensagem = null;

      const resultado = await executar(formulario({ slug: 'admin' }));

      expect(resultado.erro).toMatch(/reservado/i);
      expect(await contarUsuarios(db)).toBe(0);
    });
  });

  it('recusa slug já usado sem deixar conta órfã', async () => {
    await withTestDb(async (db) => {
      falhaAoCriarBarbearia.mensagem = null;
      await db.insert(barbershop).values({ slug: 'toca-do-ze', name: 'Outra' });

      const resultado = await executar(formulario({ email: 'outro@example.com' }));

      expect(resultado.erro).toMatch(/endereço/i);
      expect(await contarUsuarios(db)).toBe(0);
    });
  });
});

describe('signupAction — erro interno (achado 17)', () => {
  it('não devolve o detalhe cru do banco ao navegador anônimo', async () => {
    await withTestDb(async () => {
      const cru = 'Failed query: insert into "barbershop" ("id","slug") values ($1,$2)';
      falhaAoCriarBarbearia.mensagem = cru;
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const resultado = await executar(formulario());

        expect(resultado.erro).toBeTruthy();
        expect(resultado.erro).not.toContain(cru);
        expect(resultado.erro).not.toMatch(/query|insert|failed|\$1/i);
        expect(log).toHaveBeenCalled();
      } finally {
        log.mockRestore();
        falhaAoCriarBarbearia.mensagem = null;
      }
    });
  });

  it('explica no retorno como concluir o cadastro quando a barbearia falha', async () => {
    await withTestDb(async () => {
      falhaAoCriarBarbearia.mensagem = 'connection terminated unexpectedly';
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const resultado = await executar(formulario());
        expect(resultado.erro).toMatch(/mesmo e-mail e senha/i);
      } finally {
        log.mockRestore();
        falhaAoCriarBarbearia.mensagem = null;
      }
    });
  });
});

describe('signupAction — conta órfã recuperável (achado 17)', () => {
  it('completa a barbearia de quem já tem conta sem vínculo', async () => {
    await withTestDb(async (db) => {
      falhaAoCriarBarbearia.mensagem = 'connection terminated unexpectedly';
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const primeira = await executar(formulario());
      log.mockRestore();

      expect(primeira.erro).toBeTruthy();
      expect(await contarUsuarios(db)).toBe(1);
      expect(await db.select().from(barbershop)).toHaveLength(0);

      falhaAoCriarBarbearia.mensagem = null;
      const segunda = await executar(formulario());

      expect(segunda.erro).toBeUndefined();
      expect(segunda.redirecionou).toBe(true);
      expect(await contarUsuarios(db)).toBe(1);
      const [loja] = await db.select().from(barbershop);
      expect(loja.slug).toBe('toca-do-ze');
      const [dono] = await db.select().from(staff).where(eq(staff.barbershopId, loja.id));
      expect(dono.role).toBe('OWNER');
      const [usuario] = await db.select().from(user);
      expect(dono.userId).toBe(usuario.id);
    });
  });

  it('recusa quem já tem barbearia, sem revelar se a senha bate', async () => {
    await withTestDb(async (db) => {
      falhaAoCriarBarbearia.mensagem = null;
      expect((await executar(formulario())).redirecionou).toBe(true);

      const repetido = await executar(formulario({ slug: 'outra-toca' }));

      expect(repetido.erro).toMatch(/e-mail/i);
      expect(await db.select().from(barbershop)).toHaveLength(1);
    });
  });

  it('não deixa senha errada assumir a conta órfã de outra pessoa', async () => {
    await withTestDb(async (db) => {
      falhaAoCriarBarbearia.mensagem = null;
      await auth.api.signUpEmail({
        body: { name: 'Zé', email: 'ze@example.com', password: 'senha-bem-longa-123' },
      });

      const invasor = await executar(formulario({ password: 'senha-de-outro-999' }));

      expect(invasor.erro).toBeTruthy();
      expect(invasor.redirecionou).toBe(false);
      expect(await db.select().from(barbershop)).toHaveLength(0);
    });
  });
});

/**
 * Guarda de regressão: o dono termina o cadastro e tem que entrar no painel.
 * Sem o plugin `nextCookies`, `auth.api.signUpEmail` cria usuário e sessão no
 * banco e não grava o cookie — o cadastro "funciona" e joga a pessoa no login.
 */
describe('cadastro autentica de verdade', () => {
  it('a configuração do auth carrega o plugin de cookie do Next', async () => {
    const fonte = readFileSync(resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8');
    expect(fonte).toContain("from 'better-auth/next-js'");
    expect(fonte).toMatch(/plugins:\s*\[[^\]]*nextCookies\(\)/);
  });

  it('grava sessão no banco para o usuário recém-cadastrado', async () => {
    await withTestDb(async (db: TestDb) => {
      const fd = new FormData();
      fd.set('ownerName', 'Dona Zi');
      fd.set('email', `zi-${Date.now()}@example.com`);
      fd.set('password', 'senha-bem-comprida');
      fd.set('shopName', 'Barbearia da Zi');
      fd.set('slug', 'barbearia-da-zi');
      fd.set('timeZone', 'America/Sao_Paulo');

      await signupAction({}, fd).catch((e: unknown) => {
        // redirect() do Next lança de propósito; qualquer outra coisa é falha
        const digest = (e as { digest?: string })?.digest ?? '';
        if (!digest.startsWith('NEXT_REDIRECT')) throw e;
      });

      const sessoes = await db.select().from(session);
      expect(sessoes.length).toBeGreaterThan(0);
    });
  });
});
