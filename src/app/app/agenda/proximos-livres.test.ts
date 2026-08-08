import { describe, it, expect } from 'vitest';
import { calcularProximosLivres } from './proximos-livres';

const equipe = [
  { id: 'a', name: 'João' },
  { id: 'b', name: 'Pedro' },
];
const ag = (staffId: string, startAt: string, endAt: string) => ({
  staffId, startAt: new Date(startAt), endAt: new Date(endAt), status: 'BOOKED' as const,
});
const AGORA = new Date('2026-08-10T13:00:00Z'); // 10:00 em SP

describe('calcularProximosLivres', () => {
  it('barbeiro sem atendimento agora está livre agora', () => {
    const r = calcularProximosLivres([], equipe, AGORA);
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe(AGORA.toISOString());
  });

  it('barbeiro ocupado fica livre quando o atendimento termina', () => {
    const r = calcularProximosLivres(
      [ag('a', '2026-08-10T12:30:00Z', '2026-08-10T13:30:00Z')], equipe, AGORA,
    );
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe('2026-08-10T13:30:00.000Z');
  });

  it('pula atendimentos encostados e devolve o primeiro buraco de verdade', () => {
    const r = calcularProximosLivres(
      [
        ag('a', '2026-08-10T12:30:00Z', '2026-08-10T13:30:00Z'),
        ag('a', '2026-08-10T13:30:00Z', '2026-08-10T14:00:00Z'),
      ],
      equipe, AGORA,
    );
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe('2026-08-10T14:00:00.000Z');
  });

  it('agendamento cancelado não ocupa', () => {
    const r = calcularProximosLivres(
      [{ ...ag('a', '2026-08-10T12:30:00Z', '2026-08-10T13:30:00Z'), status: 'CANCELED' as const }],
      equipe, AGORA,
    );
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe(AGORA.toISOString());
  });

  it('atendimento que já acabou não conta', () => {
    const r = calcularProximosLivres(
      [ag('a', '2026-08-10T11:00:00Z', '2026-08-10T11:30:00Z')], equipe, AGORA,
    );
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe(AGORA.toISOString());
  });

  it('devolve uma entrada por barbeiro, sempre', () => {
    expect(calcularProximosLivres([], equipe, AGORA)).toHaveLength(2);
  });
});
