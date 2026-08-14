import { type Page } from '@playwright/test';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { barbershop, staff, user } from '@/db/schema';

/**
 * O único caminho de entrada no painel, para os specs que precisam de sessão.
 *
 * Nasceu dentro de `resumo.spec.ts` e mudou para cá em 14/08/2026, quando o
 * segundo spec de painel apareceu: dois caminhos de login divergem no primeiro
 * dia em que o cadastro muda de campo, e aí um dos dois passa a testar uma tela
 * que ninguém mais vê.
 *
 * **Por que a conta nasce pelo `/signup` do produto, e não por chamada direta ao
 * Better-Auth.** O plugin `nextCookies` grava o cookie de dentro de uma
 * requisição do Next; fora dela a conta nasceria sem sessão e o teste esbarraria
 * no login. De quebra, o cadastro já monta o expediente padrão — que é o
 * denominador da ocupação do resumo.
 *
 * **Por que a semente de `fixtures/seed.ts` não serve aqui.** Aquela é da grade
 * pública, que é anônima: cria a loja com um `userId` de mentira e nenhuma conta
 * de acesso.
 */
export const TZ = 'America/Sao_Paulo';

const SENHA = 'painel-e2e-2026';

/** Cada spec traz o seu par: duas execuções simultâneas não podem disputar a mesma loja. */
export type LojaDeTeste = { slug: string; email: string };

/**
 * Apaga a loja e a conta de uma execução anterior.
 *
 * A barbearia cai por `slug` e leva staff, serviços e atendimentos em cascata;
 * a conta cai depois, por e-mail, porque `staff.userId` é texto solto e não uma
 * chave estrangeira — deixar o usuário para trás faria o cadastro seguinte
 * falhar com "e-mail já está em uso".
 */
export async function limpar(loja: LojaDeTeste) {
  await db.delete(barbershop).where(eq(barbershop.slug, loja.slug));
  await db.delete(user).where(eq(user.email, loja.email));
}

/** Cadastra a barbearia pelo próprio produto e devolve a página já logada. */
export async function entrarNoPainel(page: Page, loja: LojaDeTeste) {
  await limpar(loja);

  await page.goto('/signup');
  await page.getByLabel('Seu nome').fill('Dono E2E');
  await page.getByLabel('E-mail').fill(loja.email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByLabel('Nome da barbearia').fill('Barbearia E2E');
  await page.getByLabel('Endereço da sua página').fill(loja.slug);
  await page.getByRole('button', { name: /cadastrar/i }).click();

  await page.waitForURL(/\/app\b/);

  const [criada] = await db.select().from(barbershop).where(eq(barbershop.slug, loja.slug));
  // O `/signup` tira o fuso do navegador; fixá-lo aqui deixa o teste imune a
  // uma máquina de CI em UTC, mesmo que o `timezoneId` do spec mude de valor.
  await db.update(barbershop).set({ timeZone: TZ }).where(eq(barbershop.id, criada.id));

  const [dono] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.barbershopId, criada.id), eq(staff.role, 'OWNER')));

  return { barbershopId: criada.id, staffId: dono.id };
}
