import { test, expect, type Page } from '@playwright/test';
import { DateTime } from 'luxon';

import { db } from '@/db/client';
import { appointment, customer, service, staff, staffService } from '@/db/schema';
import { entrarNoPainel, TZ, type LojaDeTeste } from './fixtures/painel';

/**
 * As duas medidas de acabamento que nenhum teste de fonte enxerga: **rolagem
 * lateral em 360px** e **controle estourando a borda do card em 1280px**.
 *
 * `tests/unit/regua-de-largura.test.ts` garante que nenhuma tela do painel
 * inventa largura própria — mas ele lê texto, e largura é coisa que só existe
 * depois do layout. Rolar de lado em 360px foi o defeito nº 1 do inventário
 * original e já voltou duas vezes; botão saindo do card foi o que a captura de
 * 1280px mostrou em serviços e em equipe.
 *
 * **Um cadastro por medida, não um por tela.** As seis telas cabem no mesmo
 * navegador e na mesma loja, e cadastrar doze vezes só faria a suíte demorar. De
 * quebra o relatório fica melhor: o teste junta **todas** as telas infratoras
 * numa lista antes de reprovar, em vez de parar na primeira — quem conserta quer
 * saber se é uma tela ou se são as seis.
 *
 * **A loja é semeada com nome comprido de propósito.** Serviço, barbeiro e
 * cliente de uma letra cabem em qualquer largura: o texto que empurra a coluna é
 * que revela a que não cabe.
 */

test.use({ timezoneId: TZ });

const LOJA: LojaDeTeste = { slug: 'e2e-acabamento', email: 'dono.acabamento@e2e.test' };

const TELAS = [
  '/app/resumo',
  '/app/agenda',
  '/app/servicos',
  '/app/equipe',
  '/app/clientes',
  '/app/configuracoes',
];

/** Uma linha em cada lista do painel, para as telas não serem medidas vazias. */
async function semear(ids: { barbershopId: string; staffId: string }) {
  const { barbershopId, staffId } = ids;

  const [combo] = await db
    .insert(service)
    .values({
      barbershopId,
      name: 'Corte + barba + sobrancelha',
      durationMinutes: 60,
      priceCents: 8500,
    })
    .returning();

  await db.insert(staffService).values({ barbershopId, staffId, serviceId: combo.id });

  await db
    .insert(staff)
    .values({ barbershopId, name: 'Sebastião do Nascimento Vale', role: 'BARBER' });

  const [cliente] = await db
    .insert(customer)
    .values({
      barbershopId,
      name: 'Maria Aparecida do Nascimento Silva',
      phone: '11988887777',
    })
    .returning();

  // O dia da agenda é o de hoje no fuso da loja, nunca `new Date('...')`: data
  // literal é lida como meia-noite UTC e, em São Paulo, cai no dia anterior.
  const hoje = DateTime.now().setZone(TZ).startOf('day');
  const em = (hora: number) => hoje.set({ hour: hora }).toJSDate();

  const base = {
    barbershopId,
    staffId,
    customerId: cliente.id,
    serviceId: combo.id,
    serviceNameSnapshot: 'Corte + barba + sobrancelha',
    servicePriceCentsSnapshot: 8500,
    serviceDurationMinutesSnapshot: 60,
    origin: 'PUBLIC' as const,
  };

  // Um agendado e um concluído: o primeiro traz os botões de presença para o
  // cartão da agenda, o segundo dá número ao resumo em vez do estado vazio.
  await db.insert(appointment).values([
    { ...base, startAt: em(9), endAt: em(10), status: 'BOOKED' },
    { ...base, startAt: em(10), endAt: em(11), status: 'DONE' },
  ]);
}

/**
 * Abre a tela e espera o conteúdo de verdade.
 *
 * O `loading.tsx` desenha a largura da tela que antecede, mas não o conteúdo
 * dela — medir durante o esqueleto é medir o desenho errado, e é justamente o
 * conteúdo que estoura.
 *
 * O `<h1>` sozinho não bastaria como âncora: três `loading.tsx` do painel já
 * desenham o cabeçalho de verdade e só deixam a lista em esqueleto. Ele é
 * `attached` e não `visible` porque o da agenda é `sr-only`.
 */
async function abrir(page: Page, tela: string) {
  await page.goto(tela);
  await page.locator('h1').first().waitFor({ state: 'attached' });
  await page.waitForFunction(
    () => document.querySelector('[data-slot="skeleton"], .esqueleto') === null,
  );
}

test('nenhuma tela do painel rola de lado em 360px', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  await semear(ids);

  // 360px é o Android popular; o layout do painel reserva 12px de cada lado, e
  // sobram 336px úteis.
  await page.setViewportSize({ width: 360, height: 740 });

  const rolando: string[] = [];
  for (const tela of TELAS) {
    await abrir(page, tela);
    const medida = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    if (medida.scroll > medida.cliente) {
      rolando.push(`${tela}: ${medida.scroll}px de conteúdo em ${medida.cliente}px de tela`);
    }
  }

  expect(rolando).toEqual([]);
});

test('nenhum controle escapa do card em 1280px', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  await semear(ids);

  // Com a sidebar aberta, que é o padrão de quem nunca a encolheu: é a largura
  // menor das duas, e a que aperta as colunas de ação.
  await page.setViewportSize({ width: 1280, height: 900 });

  const escapando: string[] = [];
  for (const tela of TELAS) {
    await abrir(page, tela);
    const fora = await page.evaluate(() => {
      const achados: string[] = [];
      document.querySelectorAll('[data-slot="card"]').forEach((card) => {
        const limite = card.getBoundingClientRect().right;
        card.querySelectorAll('button, a, input').forEach((filho) => {
          // 1px de folga: arredondamento de subpixel não é defeito de layout.
          if (filho.getBoundingClientRect().right > limite + 1) {
            achados.push(`${filho.tagName}: ${filho.textContent?.slice(0, 24)}`);
          }
        });
      });
      return achados;
    });
    escapando.push(...fora.map((achado) => `${tela} — ${achado}`));
  }

  expect(escapando).toEqual([]);
});
