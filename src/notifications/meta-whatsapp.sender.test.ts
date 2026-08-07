import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetaWhatsAppSender } from './meta-whatsapp.sender';
import type { RenderedMessage } from './sender';

vi.mock('@/lib/env', () => ({
  env: {
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_PHONE_NUMBER_ID: '1234567890',
    WHATSAPP_ACCESS_TOKEN: 'token-secreto',
    WHATSAPP_LANGUAGE: 'pt_BR',
  },
}));

const MENSAGEM: RenderedMessage = {
  templateName: 'agendamento_confirmado',
  params: ['Cliente', 'Barbearia Teste', '07/09', '09:00', 'João'],
  fallbackText: 'Olá, Cliente!',
};

const fetchFalso = vi.fn();

function respostaOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ messages: [{ id: 'wamid.123' }] }),
    text: async () => '',
  };
}

/** Corpo do POST que saiu para a Meta, já como objeto. */
function corpoEnviado() {
  const [, init] = fetchFalso.mock.calls[0];
  return JSON.parse(init.body);
}

describe('MetaWhatsAppSender', () => {
  beforeEach(() => {
    fetchFalso.mockReset();
    fetchFalso.mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchFalso);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixa o DDI quando o telefone vem só com DDD', async () => {
    await new MetaWhatsAppSender().send('11999998888', MENSAGEM);
    expect(corpoEnviado().to).toBe('5511999998888');
  });

  it('não duplica o 55 de quem já digitou o DDI', async () => {
    await new MetaWhatsAppSender().send('5511999998888', MENSAGEM);
    expect(corpoEnviado().to).toBe('5511999998888');
  });

  it('não confunde DDI com o DDD 55', async () => {
    // 55 3333-4444 é telefone de Santa Maria/RS: dez dígitos, precisa de DDI.
    await new MetaWhatsAppSender().send('5533334444', MENSAGEM);
    expect(corpoEnviado().to).toBe('555533334444');
  });

  it('manda o template aprovado com os parâmetros posicionais', async () => {
    const { providerMessageId } = await new MetaWhatsAppSender().send('11999998888', MENSAGEM);

    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v21.0/1234567890/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer token-secreto');

    const corpo = corpoEnviado();
    expect(corpo.messaging_product).toBe('whatsapp');
    expect(corpo.template.name).toBe('agendamento_confirmado');
    expect(corpo.template.language.code).toBe('pt_BR');
    expect(corpo.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(
      MENSAGEM.params,
    );
    expect(providerMessageId).toBe('wamid.123');
  });

  it('recusa telefone com quantidade impossível de dígitos, sem vazá-lo', async () => {
    await expect(new MetaWhatsAppSender().send('123', MENSAGEM)).rejects.toThrow(/dígitos/);
    expect(fetchFalso).not.toHaveBeenCalled();

    const erro = await new MetaWhatsAppSender().send('123', MENSAGEM).catch((e: Error) => e);
    expect((erro as Error).message).not.toContain('123');
  });

  it('transforma resposta de erro da Meta em exceção com o status', async () => {
    fetchFalso.mockResolvedValue({
      ok: false, status: 401, text: async () => 'token expirado', json: async () => ({}),
    });

    await expect(new MetaWhatsAppSender().send('11999998888', MENSAGEM)).rejects.toThrow(
      /Meta respondeu 401/,
    );
  });

  it('não quebra quando a Meta responde sem id de mensagem', async () => {
    fetchFalso.mockResolvedValue({ ok: true, status: 200, json: async () => ({}), text: async () => '' });

    const { providerMessageId } = await new MetaWhatsAppSender().send('11999998888', MENSAGEM);
    expect(providerMessageId).toBe('sem-id');
  });
});
