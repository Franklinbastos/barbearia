import { describe, it, expect } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  const valido = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/barbearia',
    AUTH_SECRET: 'x'.repeat(32),
    MANAGE_TOKEN_SECRET: 'y'.repeat(32),
    APP_URL: 'http://localhost:3000',
  };

  it('aceita um ambiente completo', () => {
    expect(parseEnv(valido).DATABASE_URL).toBe(valido.DATABASE_URL);
  });

  it('recusa quando falta variável obrigatória', () => {
    const { AUTH_SECRET: _AUTH_SECRET, ...incompleto } = valido;
    expect(() => parseEnv(incompleto)).toThrow(/AUTH_SECRET/);
  });

  it('recusa segredo curto demais', () => {
    expect(() => parseEnv({ ...valido, AUTH_SECRET: 'curto' })).toThrow(/AUTH_SECRET/);
  });

  it('recusa DATABASE_URL que não é postgres', () => {
    expect(() => parseEnv({ ...valido, DATABASE_URL: 'mysql://a/b' })).toThrow(/DATABASE_URL/);
  });
});
