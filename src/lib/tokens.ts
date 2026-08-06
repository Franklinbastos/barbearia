import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

const VALIDADE_MS = 90 * 24 * 60 * 60 * 1000;

function assinar(payload: string): string {
  return createHmac('sha256', env.MANAGE_TOKEN_SECRET).update(payload).digest('base64url');
}

export function signManageToken(appointmentId: string, expiresAtMs: number): string {
  const payload = `${appointmentId}.${expiresAtMs}`;
  return `${payload}.${assinar(payload)}`;
}

export function verifyManageToken(token: string, now: Date = new Date()): { appointmentId: string } | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [appointmentId, expiraTexto, assinatura] = partes;
  const esperada = assinar(`${appointmentId}.${expiraTexto}`);

  const recebidaBuf = Buffer.from(assinatura, 'base64url');
  const esperadaBuf = Buffer.from(esperada, 'base64url');
  if (recebidaBuf.length !== esperadaBuf.length) return null;
  if (!timingSafeEqual(recebidaBuf, esperadaBuf)) return null;

  const expira = Number(expiraTexto);
  if (!Number.isFinite(expira) || expira < now.getTime()) return null;

  return { appointmentId };
}

export function buildManageUrl(appointmentId: string): string {
  const token = signManageToken(appointmentId, Date.now() + VALIDADE_MS);
  return `${env.APP_URL}/agendamento/${token}`;
}
