import { DateTime } from 'luxon';
import type { AvailabilityInput, Slot } from './types';

export function parseTimeToMinutes(time: string): number {
  const [hora, minuto] = time.split(':');
  return Number(hora) * 60 + Number(minuto);
}

function localMinuteToDate(date: string, timeZone: string, minute: number): Date | null {
  const hora = String(Math.floor(minute / 60)).padStart(2, '0');
  const min = String(minute % 60).padStart(2, '0');
  const dt = DateTime.fromISO(`${date}T${hora}:${min}`, { zone: timeZone });
  if (!dt.isValid) return null;
  if (dt.hour !== Number(hora) || dt.minute !== Number(min)) return null;
  return dt.toJSDate();
}

export function computeAvailability(input: AvailabilityInput): Slot[] {
  const {
    date, timeZone, slotMinutes, minLeadMinutes,
    serviceDurationMinutes, workingBlocks, busy, now,
  } = input;

  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
    throw new Error('slotMinutes deve ser um inteiro maior que zero');
  }
  if (!Number.isInteger(serviceDurationMinutes) || serviceDurationMinutes <= 0) {
    throw new Error('A duração do serviço deve ser um inteiro maior que zero');
  }

  const slotsNecessarios = Math.ceil(serviceDurationMinutes / slotMinutes);
  const ocupacaoMinutos = slotsNecessarios * slotMinutes;
  const maisCedo = new Date(now.getTime() + minLeadMinutes * 60_000);
  const slots: Slot[] = [];

  for (const bloco of workingBlocks) {
    for (
      let offset = bloco.startMinute;
      offset + ocupacaoMinutos <= bloco.endMinute;
      offset += slotMinutes
    ) {
      const start = localMinuteToDate(date, timeZone, offset);
      if (!start) continue;

      const end = new Date(start.getTime() + ocupacaoMinutos * 60_000);
      if (start < maisCedo) continue;
      if (busy.some((b) => start < b.end && b.start < end)) continue;

      slots.push({ start, end });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
