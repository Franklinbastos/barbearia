import { describe, it, expect, afterEach } from 'vitest';
import { clientKey } from '@/lib/rate-limit';

const original = process.env.TRUSTED_IP_HEADER;

afterEach(() => {
  if (original === undefined) delete process.env.TRUSTED_IP_HEADER;
  else process.env.TRUSTED_IP_HEADER = original;
});

function pedido(cabecalhos: Record<string, string>) {
  return new Request('http://x/api', { headers: cabecalhos });
}

describe('clientKey — de onde sai o IP', () => {
  it('sem configuração, usa o 1º item do x-forwarded-for (Vercel)', () => {
    delete process.env.TRUSTED_IP_HEADER;
    const chave = clientKey(pedido({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }), 'book:loja');
    expect(chave).toBe('203.0.113.9:book:loja');
  });

  it('com TRUSTED_IP_HEADER, ignora o x-forwarded-for que o cliente pode forjar', () => {
    process.env.TRUSTED_IP_HEADER = 'CF-Connecting-IP';
    const chave = clientKey(
      pedido({ 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '198.51.100.7' }),
      'book:loja',
    );
    expect(chave).toBe('198.51.100.7:book:loja');
  });

  it('forjar o x-forwarded-for não muda a chave quando o cabeçalho confiável é outro', () => {
    process.env.TRUSTED_IP_HEADER = 'x-real-ip';
    const chaves = ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((falso) =>
      clientKey(pedido({ 'x-forwarded-for': falso, 'x-real-ip': '198.51.100.7' }), 'book:loja'),
    );
    expect(new Set(chaves).size).toBe(1);
  });
});
