import { test, expect, type Page } from '@playwright/test';
import { seed, seedComDoisBarbeiros } from './fixtures/seed';

test.beforeEach(async () => {
  await seed();
});

/** As fichas da tira de dias são os únicos botões com `aria-pressed`. */
const tiraDeDias = (page: Page) => page.locator('button[aria-pressed]');

/**
 * Abre o primeiro dia da tira, a partir de amanhã, que tenha horário livre, e
 * devolve o índice dele.
 *
 * A alternativa — ficar no dia de hoje e contar com vaga — só passa de segunda
 * a sábado e dentro do expediente: a loja semeada não abre no domingo e fecha
 * às 18h. Um teste que depende do relógio da máquina não prova nada.
 */
async function abrirDiaComVaga(page: Page): Promise<number> {
  const dias = tiraDeDias(page);
  const total = await dias.count();

  for (let i = 1; i < total; i++) {
    await dias.nth(i).click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-hora]') !== null ||
        document.body.innerText.includes('Nenhum horário livre'),
    );
    if ((await page.locator('[data-hora]').count()) > 0) return i;
  }

  throw new Error('Nenhum dia da tira tem horário livre — semente inconsistente');
}

test('cliente agenda um horário e recebe o link de gerenciamento', async ({ page }) => {
  await page.goto('/b/e2e-barbearia');

  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await abrirDiaComVaga(page);

  const primeiroHorario = page.getByTestId('slot').first();
  await expect(primeiroHorario).toBeVisible();
  // A hora sai do `data-hora`, não do texto: na grade nova o nome do barbeiro
  // desceu de linha e `split(' — ')` passou a devolver a ficha inteira.
  const horarioEscolhido = await primeiroHorario.getAttribute('data-hora');
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
  await abrirDiaComVaga(page);
  await expect(page.getByTestId('slot').first()).toBeVisible();
  await page.getByTestId('slot').first().click();
  await page.getByLabel('Seu nome').fill('Cliente E2E');
  await page.getByLabel('Telefone').fill('11999998888');
  await page.getByRole('button', { name: /confirmar horário/i }).click();

  await page.getByRole('link', { name: /ver ou cancelar/i }).click();
  // Sem `confirm()`, o cancelamento é o botão de dois tempos: o primeiro toque
  // arma, o segundo executa. O `page.once('dialog')` de antes nunca disparava.
  await page.getByRole('button', { name: /cancelar meu horário/i }).click();
  await page.getByRole('button', { name: /confirmar cancelamento/i }).click();

  await expect(page.getByText(/cancelado/i)).toBeVisible();
});

test('horário tomado some da grade', async ({ page, context }) => {
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  const indiceDoDia = await abrirDiaComVaga(page);
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
  await tiraDeDias(outra).nth(indiceDoDia).click();
  await expect(outra.getByTestId('slot').first()).toBeVisible();
  await expect(outra.getByTestId('slot')).toHaveCount(antes - 1);
});

test('com dois barbeiros livres, o mesmo horário aparece uma vez só', async ({ page }) => {
  await seedComDoisBarbeiros();
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await abrirDiaComVaga(page);

  const primeira = page.locator('[data-hora]').first();
  const hora = await primeira.getAttribute('data-hora');
  // Os dois barbeiros estão livres na mesma hora: uma ficha, não duas.
  await expect(page.locator(`[data-hora="${hora}"]`)).toHaveCount(1);
  await expect(primeira).toContainText('2 livres');
});

test('o dia escolhido sobrevive ao horário tomado', async ({ page, context }) => {
  await seed();
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  const indiceDoDia = await abrirDiaComVaga(page);
  const alvo = page.locator('[data-hora]').first();
  const hora = await alvo.getAttribute('data-hora');
  await alvo.click();

  // outra aba toma o mesmo horário
  const outra = await context.newPage();
  await outra.goto('/b/e2e-barbearia');
  await outra.getByRole('button', { name: /corte/i }).click();
  await outra.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await tiraDeDias(outra).nth(indiceDoDia).click();
  await outra.locator(`[data-hora="${hora}"]`).click();
  await outra.getByLabel('Seu nome').fill('Primeiro');
  await outra.getByLabel('Telefone').fill('11999998888');
  await outra.getByRole('button', { name: /confirmar horário/i }).click();
  await expect(outra.getByText(/horário confirmado/i)).toBeVisible();

  // a primeira aba confirma e leva o conflito
  await page.getByLabel('Seu nome').fill('Segundo');
  await page.getByLabel('Telefone').fill('11977776666');
  await page.getByRole('button', { name: /confirmar horário/i }).click();
  await expect(page.getByText(/acabou de sair|não está mais/i)).toBeVisible();
  // A tira reabre no dia que o cliente tinha escolhido, não em hoje.
  await expect(tiraDeDias(page).nth(indiceDoDia)).toHaveAttribute('aria-pressed', 'true');
});

// A outra metade da §5.4: nome e telefone também moram no `BookingWizard`, e
// não no `contact-step.tsx`, que é desmontado quando o conflito devolve o
// cliente à grade.
test('o nome e o telefone sobrevivem ao horário tomado', async ({ page, context }) => {
  await seed();
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  const indiceDoDia = await abrirDiaComVaga(page);
  const alvo = page.locator('[data-hora]').first();
  const hora = await alvo.getAttribute('data-hora');
  await alvo.click();

  const outra = await context.newPage();
  await outra.goto('/b/e2e-barbearia');
  await outra.getByRole('button', { name: /corte/i }).click();
  await outra.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await tiraDeDias(outra).nth(indiceDoDia).click();
  await outra.locator(`[data-hora="${hora}"]`).click();
  await outra.getByLabel('Seu nome').fill('Primeiro');
  await outra.getByLabel('Telefone').fill('11999998888');
  await outra.getByRole('button', { name: /confirmar horário/i }).click();
  await expect(outra.getByText(/horário confirmado/i)).toBeVisible();

  await page.getByLabel('Seu nome').fill('Segundo');
  await page.getByLabel('Telefone').fill('11977776666');
  await page.getByRole('button', { name: /confirmar horário/i }).click();
  await expect(page.getByText(/acabou de sair|não está mais/i)).toBeVisible();

  // Escolhe outro horário do mesmo dia: os dados não podem ter sumido.
  await page.locator('[data-hora]').first().click();
  await expect(page.getByLabel('Seu nome')).toHaveValue('Segundo');
  await expect(page.getByLabel('Telefone')).toHaveValue('(11) 97777-6666');
});
