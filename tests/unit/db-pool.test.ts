import { describe, it, expect } from 'vitest';
import { createDb } from '@/db/client';

/**
 * Achado 9: em serverless cada instância de função carrega o próprio pool. Com
 * `max: 5` e o `idle_timeout: null` padrão do postgres.js, a conexão ociosa
 * nunca fecha e ~22 instâncias mornas estouram o limite de um Neon pequeno.
 */
describe('pool de conexão do Postgres', () => {
  const URL_FALSA = 'postgres://barbearia:barbearia@localhost:5433/barbearia_test_b';

  it('abre no máximo uma conexão por instância', async () => {
    const db = createDb(URL_FALSA);
    try {
      expect(db.$client.options.max).toBe(1);
    } finally {
      await db.$client.end();
    }
  });

  it('devolve a conexão ociosa em vez de segurá-la para sempre', async () => {
    const db = createDb(URL_FALSA);
    try {
      expect(db.$client.options.idle_timeout).toBe(20);
      expect(db.$client.options.connect_timeout).toBe(10);
    } finally {
      await db.$client.end();
    }
  });
});
