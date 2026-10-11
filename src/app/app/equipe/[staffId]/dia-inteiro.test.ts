import { describe, it, expect } from 'vitest';
import { intervaloDoDiaInteiro } from './time-off-section';

/** Turnos no formato do banco (HH:MM:SS); `weekday` segue o Luxon: 1 = segunda … 7 = domingo. */
const EXPEDIENTE = [
  { weekday: 1, startTime: '13:00:00', endTime: '19:00:00' },
  { weekday: 1, startTime: '09:00:00', endTime: '12:00:00' },
  { weekday: 7, startTime: '08:00:00', endTime: '12:00:00' },
];

/** `Date` local, como o calendário entrega. */
const dia = (ano: number, mes: number, d: number) => new Date(ano, mes - 1, d);

describe('atalho "Dia inteiro" do bloqueio', () => {
  it('vai do começo do primeiro turno ao fim do último', () => {
    expect(intervaloDoDiaInteiro(dia(2026, 9, 7), EXPEDIENTE)).toEqual({ inicio: '09:00', fim: '19:00' });
  });

  it('domingo (getDay 0) casa com o weekday 7 do expediente', () => {
    expect(intervaloDoDiaInteiro(dia(2026, 9, 13), EXPEDIENTE)).toEqual({ inicio: '08:00', fim: '12:00' });
  });

  it('dia da semana sem expediente não tem o que bloquear', () => {
    expect(intervaloDoDiaInteiro(dia(2026, 9, 8), EXPEDIENTE)).toBeNull();
  });
});
