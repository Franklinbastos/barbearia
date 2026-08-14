import { test, expect, type Page } from '@playwright/test';
import { and, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

import { db } from '@/db/client';
import { appointment, barbershop, customer, service, staff, staffService, user } from '@/db/schema';

/**
 * O caminho do dono até os números (§5 do spec), de ponta a ponta: cadastrar,
 * achar o Resumo no painel, ler a primeira dobra, trocar o período e — na
 * barbearia que ainda não atendeu ninguém — encontrar uma explicação no lugar
 * de `0,0%`.
 *
 * **Por que a semente mora aqui e não em `fixtures/seed.ts`.** A semente de lá
 * serve à grade pública, que é anônima: cria a loja com um `userId` de mentira
 * e nenhuma conta de acesso. O resumo é tela de painel e exige sessão de
 * verdade. Ela é criada pelo próprio `/signup` do produto, e não por chamada
 * direta ao Better-Auth: o plugin `nextCookies` grava o cookie de dentro de uma
 * requisição do Next, então fora dela a conta nasceria sem sessão. De quebra,
 * o cadastro já monta o expediente padrão — que é o denominador da ocupação.
 *
 * **O relógio é da barbearia.** Todo atendimento semeado nasce de
 * `DateTime.now().setZone(TZ)`, nunca de `new Date('...')`: uma data literal é
 * lida como meia-noite UTC e, em São Paulo, cai no dia anterior — o
 * atendimento sairia da janela da semana e o teste falharia sozinho de
 * madrugada. Pela mesma razão o navegador roda em `timezoneId` fixo: é do fuso
 * dele que o `/signup` tira o fuso da loja.
 *
 * **Os números conferidos são exatos de propósito.** Dois cortes concluídos de
 * R$ 40 e R$ 60 e uma falta de R$ 50 dão R$ 100 de faturamento, R$ 50 de ticket
 * e 33% de falta — as contas do §3.1 e do §3.4. Asserção de "tem algum dígito"
 * passaria com a tela somando errado.
 */

const TZ = 'America/Sao_Paulo';

test.use({ timezoneId: TZ });

const SENHA = 'resumo-e2e-2026';

type LojaDeTeste = { slug: string; email: string };

const COM_MOVIMENTO: LojaDeTeste = { slug: 'e2e-resumo', email: 'dono.resumo@e2e.test' };
const SEM_MOVIMENTO: LojaDeTeste = { slug: 'e2e-resumo-vazia', email: 'dono.vazio@e2e.test' };

/**
 * Apaga a loja e a conta de uma execução anterior.
 *
 * A barbearia cai por `slug` e leva staff, serviços e atendimentos em cascata;
 * a conta cai depois, por e-mail, porque `staff.userId` é texto solto e não uma
 * chave estrangeira — deixar o usuário para trás faria o cadastro seguinte
 * falhar com "e-mail já está em uso".
 */
async function limpar(loja: LojaDeTeste) {
  await db.delete(barbershop).where(eq(barbershop.slug, loja.slug));
  await db.delete(user).where(eq(user.email, loja.email));
}

/** Cadastra a barbearia pelo próprio produto e devolve a página já logada. */
async function cadastrar(page: Page, loja: LojaDeTeste) {
  await limpar(loja);

  await page.goto('/signup');
  await page.getByLabel('Seu nome').fill('Dono do Resumo');
  await page.getByLabel('E-mail').fill(loja.email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByLabel('Nome da barbearia').fill('Barbearia E2E');
  await page.getByLabel('Endereço da sua página').fill(loja.slug);
  await page.getByRole('button', { name: /cadastrar/i }).click();

  await page.waitForURL(/\/app\b/);

  const [criada] = await db.select().from(barbershop).where(eq(barbershop.slug, loja.slug));
  // O `/signup` tira o fuso do navegador; fixá-lo aqui deixa o teste imune a
  // uma máquina de CI em UTC, mesmo que o `timezoneId` acima mude de valor.
  await db.update(barbershop).set({ timeZone: TZ }).where(eq(barbershop.id, criada.id));

  const [dono] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.barbershopId, criada.id), eq(staff.role, 'OWNER')));

  return { barbershopId: criada.id, staffId: dono.id };
}

/**
 * Três atendimentos **de hoje** — o único dia que cabe ao mesmo tempo na semana
 * corrente e no mês corrente. Uma semana que atravessa a virada do mês não cabe
 * inteira no mês, e o caso do seletor compararia janelas que não se contêm.
 */
async function semearMovimento(ids: { barbershopId: string; staffId: string }) {
  const { barbershopId, staffId } = ids;

  const [corte] = await db
    .insert(service)
    .values({ barbershopId, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();

  await db.insert(staffService).values({ barbershopId, staffId, serviceId: corte.id });

  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId, name: 'Cliente do Resumo', phone: '11999990000' })
    .returning();

  const hoje = DateTime.now().setZone(TZ).startOf('day');
  const em = (hora: number, minuto = 0) => hoje.set({ hour: hora, minute: minuto }).toJSDate();

  const base = {
    barbershopId,
    staffId,
    customerId: cliente.id,
    serviceId: corte.id,
    serviceNameSnapshot: 'Corte',
    serviceDurationMinutesSnapshot: 30,
    origin: 'PUBLIC' as const,
  };

  await db.insert(appointment).values([
    { ...base, servicePriceCentsSnapshot: 4000, startAt: em(9), endAt: em(9, 30), status: 'DONE' },
    { ...base, servicePriceCentsSnapshot: 6000, startAt: em(10), endAt: em(10, 30), status: 'DONE' },
    {
      ...base,
      servicePriceCentsSnapshot: 5000,
      startAt: em(11),
      endAt: em(11, 30),
      status: 'NO_SHOW',
    },
  ]);
}

/** O rótulo que `resolverPeriodo` monta para o mês corrente: "agosto de 2026". */
function rotuloDoMesCorrente(): string {
  return DateTime.now()
    .setZone(TZ)
    .setLocale('pt-BR')
    .toLocaleString({ month: 'long', year: 'numeric' });
}

/** O card da primeira dobra com aquele título. */
function cartao(page: Page, titulo: string) {
  return page.locator('[data-slot="cartao-indicador"]').filter({ hasText: titulo });
}

function valorDo(page: Page, titulo: string) {
  return cartao(page, titulo).locator('[data-slot="cartao-indicador-valor"]');
}

test('o dono chega ao Resumo pelo painel e lê os quatro números da primeira dobra', async ({
  page,
}) => {
  const ids = await cadastrar(page, COM_MOVIMENTO);
  await semearMovimento(ids);

  // Pelo painel, não pela URL: o Resumo é a primeira seção da sidebar desde
  // 14/08/2026, e é assim que o dono chega nele.
  await page.goto('/app/agenda');
  // `exact` porque o nome acessível casa por substring: sem ele o link da
  // identidade no topo da sidebar entraria junto se a loja tivesse "Resumo" no
  // nome, e o teste morreria em modo estrito.
  await page.getByRole('link', { name: 'Resumo', exact: true }).click();
  await page.waitForURL(/\/app\/resumo/);

  // R$ 40 + R$ 60 concluídos; a falta de R$ 50 não entra no faturamento.
  await expect(valorDo(page, 'Faturamento')).toHaveText(/R\$\s*100/);
  await expect(valorDo(page, 'Ticket médio')).toHaveText(/R\$\s*50/);
  // 1 falta em 2 atendidos + 1 falta.
  await expect(valorDo(page, 'Taxa de falta')).toHaveText('33%');
  // A ocupação depende do expediente do dia da semana, então o número varia
  // conforme o dia em que a suíte roda. Num domingo — o único dia sem
  // expediente no cadastro padrão — não há denominador, e aí o card mostra
  // traço em vez de `0%`, que leria como cadeira parada numa loja fechada.
  await expect(valorDo(page, 'Ocupação')).toHaveText(/^(\d+%|—)$/);

  // A receita perdida com a falta é a linha de apoio do §3.1.
  await expect(cartao(page, 'Taxa de falta')).toContainText(/R\$\s*50/);
});

test('trocar para Mês muda a URL e o período que a tela mostra', async ({ page }) => {
  const ids = await cadastrar(page, COM_MOVIMENTO);
  await semearMovimento(ids);

  await page.goto('/app/resumo');
  const rotuloDoMes = page.getByText(rotuloDoMesCorrente(), { exact: true });
  // Na semana o cabeçalho diz "10 a 16 de agosto"; o nome do mês sozinho não
  // está em lugar nenhum ainda.
  await expect(rotuloDoMes).toHaveCount(0);

  await page.getByRole('button', { name: 'Mês' }).click();

  await expect(page).toHaveURL(/periodo=mes/);
  // O conteúdo muda junto: URL nova sem tela nova seria um seletor que não
  // seleciona nada.
  await expect(rotuloDoMes).toBeVisible();
  // E os números continuam de pé — hoje cabe nas duas janelas.
  await expect(valorDo(page, 'Faturamento')).toHaveText(/R\$\s*100/);
});

test('barbearia sem atendimento explica o que falta, em vez de mostrar zero', async ({ page }) => {
  await cadastrar(page, SEM_MOVIMENTO);

  await page.goto('/app/resumo');

  await expect(page.getByText(/ainda não há atendimento para medir/i)).toBeVisible();
  await expect(page.getByText(/primeiros atendimentos/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /abrir a agenda/i })).toBeVisible();

  // O ponto do estado vazio: nenhum card de número na tela, e nenhum zero
  // fingindo ser resultado.
  await expect(page.locator('[data-slot="cartao-indicador"]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('0%');
});
