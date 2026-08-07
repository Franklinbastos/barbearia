import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseEnv } from '@/lib/env';

const VALIDO = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/barbearia',
  AUTH_SECRET: 'x'.repeat(32),
  MANAGE_TOKEN_SECRET: 'y'.repeat(32),
  APP_URL: 'http://localhost:3000',
  CRON_SECRET: 'z'.repeat(16),
};

describe('parseEnv — segredo de exemplo em produção (achado 8)', () => {
  const placeholders = [
    'CHANGE_ME',
    'change_me',
    'CHANGE_ME_gere_um_segredo_de_32_caracteres',
    'troque-por-32-caracteres-aleatorios-ok',
    'outro-segredo-de-32-caracteres-aqui',
    'troque-por-16-caracteres-ou-mais',
  ];

  for (const valor of placeholders) {
    it(`recusa AUTH_SECRET com o valor de exemplo "${valor}"`, () => {
      expect(() => parseEnv({ ...VALIDO, AUTH_SECRET: valor })).toThrow(/AUTH_SECRET/);
    });
  }

  it('recusa MANAGE_TOKEN_SECRET de exemplo', () => {
    expect(() =>
      parseEnv({ ...VALIDO, MANAGE_TOKEN_SECRET: 'outro-segredo-de-32-caracteres-aqui' }),
    ).toThrow(/MANAGE_TOKEN_SECRET/);
  });

  it('recusa CRON_SECRET de exemplo', () => {
    expect(() => parseEnv({ ...VALIDO, CRON_SECRET: 'CHANGE_ME_troque_isto' })).toThrow(/CRON_SECRET/);
  });

  it('aceita segredo aleatório de verdade', () => {
    expect(parseEnv(VALIDO).AUTH_SECRET).toBe(VALIDO.AUTH_SECRET);
  });
});

describe('parseEnv — WhatsApp ligado sem credencial (achado 8)', () => {
  it('recusa WHATSAPP_ENABLED=true sem o número e sem o token', () => {
    expect(() => parseEnv({ ...VALIDO, WHATSAPP_ENABLED: 'true' })).toThrow(
      /WHATSAPP_PHONE_NUMBER_ID/,
    );
  });

  it('recusa WHATSAPP_ENABLED=true com o token vazio', () => {
    expect(() =>
      parseEnv({
        ...VALIDO,
        WHATSAPP_ENABLED: 'true',
        WHATSAPP_PHONE_NUMBER_ID: '123456',
        WHATSAPP_ACCESS_TOKEN: '   ',
      }),
    ).toThrow(/WHATSAPP_ACCESS_TOKEN/);
  });

  it('aceita WHATSAPP_ENABLED=true com as duas credenciais', () => {
    const env = parseEnv({
      ...VALIDO,
      WHATSAPP_ENABLED: 'true',
      WHATSAPP_PHONE_NUMBER_ID: '123456',
      WHATSAPP_ACCESS_TOKEN: 'EAAG...token',
    });
    expect(env.WHATSAPP_ENABLED).toBe('true');
  });

  it('não exige credencial quando o WhatsApp está desligado', () => {
    expect(parseEnv({ ...VALIDO, WHATSAPP_ENABLED: 'false' }).WHATSAPP_ENABLED).toBe('false');
  });
});

describe('.env.example não pode subir para produção como está (achado 8)', () => {
  const exemplo = Object.fromEntries(
    readFileSync(new URL('../../.env.example', import.meta.url), 'utf8')
      .split('\n')
      .filter((linha) => linha.trim() !== '' && !linha.trimStart().startsWith('#'))
      .map((linha) => {
        const corte = linha.indexOf('=');
        return [linha.slice(0, corte).trim(), linha.slice(corte + 1).trim()];
      }),
  ) as Record<string, string>;

  it('reprova na validação de ambiente em vez de passar por comprimento', () => {
    expect(() => parseEnv(exemplo)).toThrow(/AUTH_SECRET|MANAGE_TOKEN_SECRET|CRON_SECRET/);
  });

  it('não traz segredo com cara de pronto para uso', () => {
    for (const chave of ['AUTH_SECRET', 'MANAGE_TOKEN_SECRET', 'CRON_SECRET']) {
      expect(exemplo[chave], chave).toMatch(/^CHANGE_ME/i);
    }
  });
});
