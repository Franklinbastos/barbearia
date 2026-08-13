import 'dotenv/config';

import { defineConfig } from '@playwright/test';

/**
 * A porta sai do `APP_URL` do `.env`, não de um literal.
 *
 * O produto monta o link de gerenciamento do cliente com `APP_URL`
 * (`src/lib/tokens.ts`). Se o Playwright subir numa porta e o `APP_URL` apontar
 * para outra, o teste clica num link que leva a lugar nenhum — e a falha parece
 * defeito de aplicação, não de configuração. Foi o que aconteceu quando a 3000
 * ficou presa por um processo do Windows e o `.env` passou para a 3333.
 */
const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
const porta = new URL(appUrl).port || '3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: appUrl, locale: 'pt-BR' },
  webServer: {
    command: `npx next dev --port ${porta}`,
    url: appUrl,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
