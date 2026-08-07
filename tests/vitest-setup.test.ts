import { describe, it, expect } from 'vitest';
import { URL_TESTE_PADRAO, resolveTestDatabaseUrl } from '../vitest.setup';

describe('resolução da URL do banco de teste', () => {
  it('usa DATABASE_URL_TEST quando ela existe', () => {
    const url = resolveTestDatabaseUrl({
      DATABASE_URL: 'postgres://barbearia:barbearia@localhost:5433/barbearia',
      DATABASE_URL_TEST: 'postgres://barbearia:barbearia@localhost:5433/barbearia_test_x',
    });
    expect(url).toBe('postgres://barbearia:barbearia@localhost:5433/barbearia_test_x');
  });

  it('cai no banco de teste padrão quando DATABASE_URL_TEST não existe', () => {
    const url = resolveTestDatabaseUrl({
      DATABASE_URL: 'postgres://barbearia:barbearia@localhost:5433/barbearia',
    });
    expect(url).toBe(URL_TESTE_PADRAO);
    expect(URL_TESTE_PADRAO).toBe('postgres://barbearia:barbearia@localhost:5433/barbearia_test');
  });

  it('ignora DATABASE_URL_TEST vazia e cai no padrão', () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL_TEST: '   ' })).toBe(URL_TESTE_PADRAO);
  });

  it('aborta quando a URL final aponta para o banco de desenvolvimento', () => {
    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL_TEST: 'postgres://barbearia:barbearia@localhost:5433/barbearia',
      }),
    ).toThrowError(/banco de desenvolvimento/i);
  });

  it('aborta mesmo com parâmetros de conexão depois do nome do banco', () => {
    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL_TEST: 'postgres://barbearia:barbearia@localhost:5433/barbearia?sslmode=disable',
      }),
    ).toThrowError(/banco de desenvolvimento/i);
  });

  it('não confunde um banco cujo nome só termina em barbearia', () => {
    const url = 'postgres://barbearia:barbearia@localhost:5433/outra_barbearia';
    expect(resolveTestDatabaseUrl({ DATABASE_URL_TEST: url })).toBe(url);
  });

  it('deixa process.env.DATABASE_URL apontando para um banco de teste', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.DATABASE_URL).not.toMatch(/\/barbearia$/);
    expect(process.env.DATABASE_URL).toBe(process.env.DATABASE_URL_TEST ?? URL_TESTE_PADRAO);
  });
});
