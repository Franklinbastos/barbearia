import { expect, test } from '@playwright/test';

import { entrarNoPainel, type LojaDeTeste, TZ } from './fixtures/painel';

const LOJA: LojaDeTeste = { slug: 'e2e-assinatura', email: 'dono.assinatura@e2e.test' };
const LOJA_CHECKOUT: LojaDeTeste = {
  slug: 'e2e-assinatura-checkout',
  email: 'dono.assinatura.checkout@e2e.test',
};

test.use({ timezoneId: TZ });
test.skip(
  process.env.TEMPRA_BILLING_E2E !== 'true',
  'depende do Tempra Billing e do Asaas Sandbox configurados',
);

test('exibe o catálogo real e mantém o checkout utilizável em desktop e celular', async ({
  page,
}) => {
  await entrarNoPainel(page, LOJA);
  await page.goto('/app/assinatura');

  await expect(page.getByRole('heading', { name: 'Assinatura', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Essencial', exact: true, level: 3 })).toBeVisible();
  await expect(page.getByText('R$ 29,90').first()).toBeVisible();
  await expect(page.getByText('300 mensagens automáticas por mês').first()).toBeVisible();
  await expect(page.getByLabel('CPF ou CNPJ')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assinar Essencial', exact: true })).toBeVisible();

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/assinatura-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Assinar Essencial', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/assinatura-mobile.png', fullPage: true });
});

test('cria o checkout pelo servidor e entrega o pagamento ao Asaas', async ({ page }) => {
  await entrarNoPainel(page, LOJA_CHECKOUT);
  await page.goto('/app/assinatura');

  await page.getByLabel('CPF ou CNPJ').fill('52998224725');
  await page.getByLabel('Telefone').fill('11987654321');
  await page.getByLabel('CEP').fill('01310100');
  await page.getByLabel('Endereço').fill('Avenida Paulista');
  await page.getByLabel('Número').fill('1000');
  await page.getByLabel('Bairro').fill('Bela Vista');
  await page.getByRole('button', { name: 'Assinar Essencial', exact: true }).click();

  await page.waitForURL((url) => url.hostname.endsWith('asaas.com'), { timeout: 20_000 });
  expect(new URL(page.url()).hostname).toMatch(/asaas\.com$/);
});
