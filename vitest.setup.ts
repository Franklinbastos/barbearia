import 'dotenv/config';

/**
 * Banco usado pelos testes quando `DATABASE_URL_TEST` não está definida.
 * Precisa existir antes de rodar a suíte — ver a seção "Testes" do README.
 */
export const URL_TESTE_PADRAO = 'postgres://barbearia:barbearia@localhost:5433/barbearia_test';

/** Nome do banco de desenvolvimento, proibido para os testes. */
const BANCO_PROIBIDO = 'barbearia';

type FonteDeEnv = Record<string, string | undefined>;

/**
 * Barreira final: qualquer URL que aponte para o banco de desenvolvimento
 * derruba a suíte com mensagem explicando o que fazer.
 */
export function garantirBancoDeTeste(url: string): string {
  const semParametros = url.split(/[?#]/)[0].replace(/\/+$/, '');

  if (semParametros.endsWith(`/${BANCO_PROIBIDO}`)) {
    throw new Error(
      `A suíte de testes não roda contra o banco de desenvolvimento "${BANCO_PROIBIDO}" — ` +
        'os testes fazem TRUNCATE das tabelas e apagariam seus dados. ' +
        'Defina DATABASE_URL_TEST apontando para um banco dedicado, por exemplo ' +
        `"${URL_TESTE_PADRAO}", e crie-o com: ` +
        'docker exec barbearia-postgres psql -U barbearia -d postgres -c "CREATE DATABASE barbearia_test"',
    );
  }

  return url;
}

/**
 * Decide contra qual banco a suíte roda. `DATABASE_URL_TEST` manda; na falta
 * dela vale `URL_TESTE_PADRAO`. `DATABASE_URL` (que vem do `.env` de
 * desenvolvimento) é ignorada de propósito: teste nunca escreve no banco de
 * quem está desenvolvendo.
 */
export function resolveTestDatabaseUrl(fonte: FonteDeEnv = process.env): string {
  return garantirBancoDeTeste(fonte.DATABASE_URL_TEST?.trim() || URL_TESTE_PADRAO);
}

// Roda antes de qualquer import de banco (vitest carrega os setupFiles antes do
// arquivo de teste), então `src/db/client.ts` e `tests/helpers/db.ts` já leem a
// URL de teste. `dotenv` não sobrescreve variável já definida, então esta
// atribuição sobrevive a qualquer `import 'dotenv/config'` posterior.
process.env.DATABASE_URL = resolveTestDatabaseUrl();

/**
 * Desmontagem entre casos nos testes de componente.
 *
 * Só rodam em jsdom (`// @vitest-environment jsdom` no topo do arquivo), e sem
 * isto o segundo `render()` de um `describe` deixa o primeiro na página — a
 * busca por papel acha dois botões e o caso falha por um motivo que não é o
 * dele. A @testing-library registra o `cleanup` sozinha quando `globals` está
 * ligado; ligar globals na suíte inteira por causa de uma linha é caro demais.
 */
if (typeof document !== 'undefined') {
  const { afterEach } = await import('vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
