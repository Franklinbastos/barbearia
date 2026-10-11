import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';

import { db } from '@/db/client';
import { appointment, customer, service, staff, staffService, timeOff, workingHours } from '@/db/schema';
import { entrarNoPainel, TZ, type LojaDeTeste } from './fixtures/painel';

/**
 * Bloqueios e folgas na agenda (decisões de 19/09/2026):
 * - bloqueio vira linha própria, em cinza, com o motivo;
 * - o horário bloqueado some dos vãos livres;
 * - dia de folga aparece na barra e no calendário, com a lista de quem folga.
 */
const LOJA: LojaDeTeste = { slug: 'e2e-bloqueios', email: 'dono.bloqueios@e2e.test' };

test.use({ timezoneId: TZ });

/** Uma quarta-feira pelo menos dois dias à frente: o recorte do "agora" não mexe nos vãos. */
function quartaQueVem() {
  let dia = DateTime.now().setZone(TZ).plus({ days: 2 }).startOf('day');
  while (dia.weekday !== 3) dia = dia.plus({ days: 1 });
  return dia;
}

async function semear(barbershopId: string, donoId: string) {
  const dia = quartaQueVem();
  const em = (hora: string) => DateTime.fromISO(`${dia.toISODate()}T${hora}`, { zone: TZ }).toJSDate();

  const [corte] = await db
    .insert(service)
    .values({ barbershopId, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  const [tiago] = await db.insert(staff).values({ barbershopId, name: 'Tiago', role: 'BARBER' }).returning();
  await db.insert(staffService).values([
    { barbershopId, staffId: donoId, serviceId: corte.id },
    { barbershopId, staffId: tiago.id, serviceId: corte.id },
  ]);
  await db.insert(workingHours).values({
    barbershopId, staffId: tiago.id, weekday: 3, startTime: '09:00:00', endTime: '18:00:00',
  });
  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId, name: 'Marcos', phone: '11988887777' })
    .returning();

  const snapshot = {
    barbershopId, customerId: cliente.id, serviceId: corte.id,
    serviceNameSnapshot: 'Corte', servicePriceCentsSnapshot: 4000, serviceDurationMinutesSnapshot: 30,
  };
  await db.insert(appointment).values([
    { ...snapshot, staffId: donoId, startAt: em('10:00'), endAt: em('10:30') },
    { ...snapshot, staffId: donoId, startAt: em('17:00'), endAt: em('17:30') },
  ]);
  await db.insert(timeOff).values([
    // Bloqueio parcial do dono: linha na agenda, não folga.
    { barbershopId, staffId: donoId, startAt: em('15:00'), endAt: em('16:00'), reason: 'Médico' },
    // Tiago bloqueado no expediente todo: folga.
    { barbershopId, staffId: tiago.id, startAt: em('09:00'), endAt: em('18:00'), reason: null },
  ]);

  return dia;
}

test('a agenda mostra o bloqueio, não oferece o horário bloqueado e avisa a folga', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const ids = await entrarNoPainel(page, LOJA);
  const dia = await semear(ids.barbershopId, ids.staffId);

  await page.goto(`/app/agenda?data=${dia.toISODate()}`);

  // Só o que está visível: durante o streaming o React monta o trecho novo num
  // contêiner escondido (`<div hidden id="S:0">`) antes de movê-lo, e por ~200 ms
  // há duas cópias no DOM. Quem usa nunca vê a segunda; o teste também não deve.
  const bloqueio = page.locator('[data-slot="bloqueio"]:visible').filter({ hasText: 'Médico' });
  await expect(bloqueio).toHaveCount(1);
  await expect(bloqueio).toBeVisible();
  await expect(bloqueio).toContainText('15:00–16:00 · Dono E2E · Médico');

  // Nenhum vão livre do dono começa dentro do bloqueio (15:00–16:00).
  const vaos = await page.locator('[data-slot="vao-livre"]').allTextContents();
  expect(vaos.some((t) => /^\s*15:\d\d/.test(t))).toBe(false);
  expect(vaos.some((t) => t.includes('16:00'))).toBe(true);

  await expect(page.getByText(/Tiago de folga/).first()).toBeVisible();
  // Bloqueio sem motivo cobrindo o expediente todo diz "Folga".
  await expect(page.locator('[data-slot="bloqueio"]:visible').filter({ hasText: 'Tiago' })).toContainText('Tiago · Folga');
  await page.screenshot({ path: 'test-results/bloqueios-agenda-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /escolher outro dia/ }).click();
  const folgas = page.locator('[data-slot="folgas-do-mes"]');
  await expect(folgas).toBeVisible();
  await expect(folgas).toContainText(`${dia.day} · Tiago de folga`);
  await expect(folgas).toContainText('Fechado aos domingos');
  await expect(folgas).toContainText('Tiago trabalha só às quartas');
  await page.screenshot({ path: 'test-results/bloqueios-calendario.png' });
});

test('no celular, o bloqueio aparece na lista e a folga na linha de baixo da barra', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const ids = await entrarNoPainel(page, LOJA);
  const dia = await semear(ids.barbershopId, ids.staffId);

  await page.goto(`/app/agenda?data=${dia.toISODate()}`);

  const bloqueio = page.locator('[data-slot="bloqueio"]:visible').filter({ hasText: 'Médico' });
  await expect(bloqueio).toHaveCount(1);
  await expect(bloqueio).toBeVisible();
  await expect(page.locator('p:visible').filter({ hasText: /Tiago de folga/ })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/bloqueios-agenda-celular.png', fullPage: true });
});

test('"Dia inteiro" no bloqueio pede a data antes e usa o expediente do dia', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const ids = await entrarNoPainel(page, LOJA);

  await page.goto(`/app/equipe/${ids.staffId}`);
  await page.getByText('Dia inteiro').click();
  await expect(page.getByText('Escolha a data para usar o expediente do dia.')).toBeVisible();
  // Com o atalho ligado e sem data, os campos de hora continuam: nada é enviado às cegas.
  await expect(page.getByLabel('Início', { exact: true })).toBeVisible();
});
