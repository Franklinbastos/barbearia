import { NextResponse } from 'next/server';
import { NotFoundError, SlotTakenError, SlotUnavailableError } from '@/domain/booking';

export function toApiError(erro: unknown): NextResponse {
  if (erro instanceof SlotTakenError || erro instanceof SlotUnavailableError) {
    return NextResponse.json({ error: erro.code, message: erro.message }, { status: 409 });
  }
  if (erro instanceof NotFoundError) {
    return NextResponse.json({ error: 'NOT_FOUND', message: erro.message }, { status: 404 });
  }
  console.error('Erro não tratado na API pública', erro);
  return NextResponse.json(
    { error: 'INTERNAL', message: 'Não foi possível concluir. Tente de novo.' },
    { status: 500 },
  );
}

export function invalidInput(message: string): NextResponse {
  return NextResponse.json({ error: 'INVALID_INPUT', message }, { status: 400 });
}
