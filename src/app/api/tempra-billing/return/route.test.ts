import { describe, expect, it } from 'vitest';

import { env } from '@/lib/env';
import { GET } from './route';

describe('ponte de retorno do Billing', () => {
  it('redireciona o retorno HTTPS para a origem do app', () => {
    const resposta = GET(
      new Request('https://tunel.example.com/api/tempra-billing/return?resultado=cancelado'),
    );
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get('location')).toBe(
      `${env.APP_URL}/app/assinatura/retorno?resultado=cancelado`,
    );
  });

  it('não aceita um destino arbitrário vindo da query string', () => {
    const resposta = GET(
      new Request(
        'https://tunel.example.com/api/tempra-billing/return?resultado=sucesso&destino=https://evil.test',
      ),
    );
    expect(resposta.headers.get('location')).toBe(
      `${env.APP_URL}/app/assinatura/retorno?resultado=sucesso`,
    );
  });
});
