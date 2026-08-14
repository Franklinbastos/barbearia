import { test, expect, type Page } from '@playwright/test';
import { DateTime } from 'luxon';

import { db } from '@/db/client';
import { appointment, customer, service, staffService } from '@/db/schema';
import { entrarNoPainel, TZ, type LojaDeTeste } from './fixtures/painel';

/**
 * O caminho do dono até os números (§5 do spec), de ponta a ponta: cadastrar,
 * achar o Resumo no painel, ler a primeira dobra, trocar o período e — na
 * barbearia que ainda não atendeu ninguém — encontrar uma explicação no lugar
 * de `0,0%`.
 *
 * **O login mora em `fixtures/painel.ts`** desde 14/08/2026 — nasceu aqui e saiu
 * quando o segundo spec de painel apareceu. A semente de movimento continua
 * neste arquivo porque os números conferidos abaixo são dela, e de mais ninguém.
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

test.use({ timezoneId: TZ });

const COM_MOVIMENTO: LojaDeTeste = { slug: 'e2e-resumo', email: 'dono.resumo@e2e.test' };
const SEM_MOVIMENTO: LojaDeTeste = { slug: 'e2e-resumo-vazia', email: 'dono.vazio@e2e.test' };

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
  const ids = await entrarNoPainel(page, COM_MOVIMENTO);
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
  const ids = await entrarNoPainel(page, COM_MOVIMENTO);
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
  await entrarNoPainel(page, SEM_MOVIMENTO);

  await page.goto('/app/resumo');

  await expect(page.getByText(/ainda não há atendimento para medir/i)).toBeVisible();
  await expect(page.getByText(/primeiros atendimentos/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /abrir a agenda/i })).toBeVisible();

  // O ponto do estado vazio: nenhum card de número na tela, e nenhum zero
  // fingindo ser resultado.
  await expect(page.locator('[data-slot="cartao-indicador"]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('0%');
});
