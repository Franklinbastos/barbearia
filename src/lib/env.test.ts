import { describe, it, expect } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  const valido = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/barbearia',
    AUTH_SECRET: 'x'.repeat(32),
    MANAGE_TOKEN_SECRET: 'y'.repeat(32),
    APP_URL: 'http://localhost:3000',
    CRON_SECRET: 'z'.repeat(16),
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

  it('não exige o Billing quando a integração está desligada', () => {
    expect(parseEnv(valido).TEMPRA_BILLING_ENABLED).toBe('false');
    expect(parseEnv({ ...valido, TEMPRA_BILLING_API_KEY: 'CHANGE_ME' }).TEMPRA_BILLING_ENABLED).toBe(
      'false',
    );
  });

  it('exige URL e chave quando o Billing está ligado', () => {
    expect(() => parseEnv({ ...valido, TEMPRA_BILLING_ENABLED: 'true' })).toThrow(
      /TEMPRA_BILLING_URL|TEMPRA_BILLING_API_KEY/,
    );
  });

  it('aceita a configuração completa do Billing', () => {
    const resultado = parseEnv({
      ...valido,
      TEMPRA_BILLING_ENABLED: 'true',
      TEMPRA_BILLING_URL: 'http://localhost:3333',
      TEMPRA_BILLING_API_KEY: 'b'.repeat(32),
      TEMPRA_BILLING_RETURN_URL: 'https://barbearia-teste.example.com',
    });
    expect(resultado.TEMPRA_BILLING_URL).toBe('http://localhost:3333');
    expect(resultado.TEMPRA_BILLING_RETURN_URL).toBe('https://barbearia-teste.example.com');
  });

  it('aceita percentual configurável de alerta de saldo', () => {
    expect(parseEnv({ ...valido, TEMPRA_BILLING_LOW_BALANCE_PERCENT: '15' }).TEMPRA_BILLING_LOW_BALANCE_PERCENT).toBe(15);
  });
});
