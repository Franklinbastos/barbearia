import { test, expect } from '@playwright/test';
import { seed } from './fixtures/seed';

test.beforeEach(async () => {
  await seed();
});

test('cliente agenda um horário e recebe o link de gerenciamento', async ({ page }) => {
  await page.goto('/b/e2e-barbearia');

  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();

  const primeiroHorario = page.getByTestId('slot').first();
  await expect(primeiroHorario).toBeVisible();
  const horarioEscolhido = (await primeiroHorario.textContent())?.trim().split(' — ')[0];
  await primeiroHorario.click();

  await page.getByLabel('Seu nome').fill('Cliente E2E');
  await page.getByLabel('Telefone').fill('11999998888');
  await page.getByRole('button', { name: /confirmar horário/i }).click();

  await expect(page.getByText(/horário confirmado/i)).toBeVisible();
  const link = page.getByRole('link', { name: /ver ou cancelar/i });
  await expect(link).toBeVisible();

  await link.click();
  await expect(page.getByText(String(horarioEscolhido))).toBeVisible();
});

test('cliente cancela o horário pelo link', async ({ page }) => {
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await expect(page.getByTestId('slot').first()).toBeVisible();
  await page.getByTestId('slot').first().click();
  await page.getByLabel('Seu nome').fill('Cliente E2E');
  await page.getByLabel('Telefone').fill('11999998888');
  await page.getByRole('button', { name: /confirmar horário/i }).click();

  await page.getByRole('link', { name: /ver ou cancelar/i }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /cancelar meu horário/i }).click();

  await expect(page.getByText(/cancelado/i)).toBeVisible();
});

test('horário tomado some da grade', async ({ page, context }) => {
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await expect(page.getByTestId('slot').first()).toBeVisible();
  const antes = await page.getByTestId('slot').count();
  await page.getByTestId('slot').first().click();
  await page.getByLabel('Seu nome').fill('Cliente E2E');
  await page.getByLabel('Telefone').fill('11999998888');
  await page.getByRole('button', { name: /confirmar horário/i }).click();
  await expect(page.getByText(/horário confirmado/i)).toBeVisible();

  const outra = await context.newPage();
  await outra.goto('/b/e2e-barbearia');
  await outra.getByRole('button', { name: /corte/i }).click();
  await outra.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await expect(outra.getByTestId('slot').first()).toBeVisible();
  await expect(outra.getByTestId('slot')).toHaveCount(antes - 1);
});
