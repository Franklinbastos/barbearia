import { DateTime } from 'luxon';
import { OutsideBookingWindowError } from './errors';

/**
 * Último dia que a barbearia aceita agendar, no fuso dela. O navegador já monta
 * a fileira de dias com essa conta, mas quem manda POST direto não passa pelo
 * navegador — por isso a regra também vale aqui, no servidor.
 */
export function bookingWindowLimit(
  loja: { timeZone: string; maxAdvanceDays: number },
  agora: Date,
): DateTime {
  return DateTime.fromJSDate(agora)
    .setZone(loja.timeZone)
    .startOf('day')
    .plus({ days: loja.maxAdvanceDays });
}

/** Recusa dia além da janela. Dia passado fica de fora: a grade já não o oferece. */
export function assertWithinBookingWindow(
  loja: { timeZone: string; maxAdvanceDays: number },
  dia: DateTime,
  agora: Date,
): void {
  const limite = bookingWindowLimit(loja, agora);
  if (dia.setZone(loja.timeZone).startOf('day') > limite) {
    throw new OutsideBookingWindowError(
      `Esta barbearia agenda com até ${loja.maxAdvanceDays} dias de antecedência`,
    );
  }
}
