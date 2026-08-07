import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    MANAGE_TOKEN_SECRET: 'segredo-de-teste-com-32-caracteres!',
    APP_URL: 'https://agenda.exemplo.com',
    DATABASE_URL: 'postgres://x',
    AUTH_SECRET: 'a'.repeat(32),
  },
}));

const { signManageToken, verifyManageToken, buildManageUrl } = await import('./tokens');

const ID = '11111111-1111-4111-8111-111111111111';
const DAQUI_UMA_HORA = Date.now() + 3_600_000;

describe('manage token', () => {
  it('assina e verifica o mesmo agendamento', () => {
    const token = signManageToken(ID, DAQUI_UMA_HORA);
    expect(verifyManageToken(token)).toEqual({ appointmentId: ID });
  });

  it('recusa token com assinatura adulterada', () => {
    const token = signManageToken(ID, DAQUI_UMA_HORA);
    const adulterado = token.slice(0, -3) + 'aaa';
    expect(verifyManageToken(adulterado)).toBeNull();
  });

  it('recusa token com id trocado', () => {
    const token = signManageToken(ID, DAQUI_UMA_HORA);
    const partes = token.split('.');
    const outro = ['22222222-2222-4222-8222-222222222222', partes[1], partes[2]].join('.');
    expect(verifyManageToken(outro)).toBeNull();
  });

  it('recusa token vencido', () => {
    const token = signManageToken(ID, Date.now() - 1000);
    expect(verifyManageToken(token)).toBeNull();
  });

  it('recusa token malformado', () => {
    expect(verifyManageToken('nada-a-ver')).toBeNull();
    expect(verifyManageToken('')).toBeNull();
    expect(verifyManageToken('a.b')).toBeNull();
  });

  it('monta a URL de gerenciamento com o host configurado', () => {
    expect(buildManageUrl(ID)).toMatch(/^https:\/\/agenda\.exemplo\.com\/agendamento\/.+/);
  });
});
