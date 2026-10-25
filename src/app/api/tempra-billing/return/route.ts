import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';

const resultadoSchema = z.enum(['sucesso', 'cancelado', 'expirado']);

/**
 * Ponte para o Asaas Sandbox: o provedor exige HTTPS, mas a sessão local mora
 * em localhost. O túnel chega aqui e volta imediatamente para a origem fixa do
 * app, onde os cookies do painel e do checkout existem.
 */
export function GET(request: Request) {
  const recebido = new URL(request.url).searchParams.get('resultado');
  const resultado = resultadoSchema.catch('sucesso').parse(recebido);
  const destino = new URL('/app/assinatura/retorno', env.APP_URL);
  destino.searchParams.set('resultado', resultado);
  return NextResponse.redirect(destino);
}
