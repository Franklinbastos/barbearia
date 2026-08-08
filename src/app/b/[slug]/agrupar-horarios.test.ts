import { describe, it, expect } from 'vitest';
import { agruparHorarios } from './agrupar-horarios';

const TZ = 'America/Sao_Paulo';
const slot = (iso: string, staffId: string, staffName: string) => ({
  startAt: iso, staffId, staffName,
});

describe('agruparHorarios', () => {
  it('separa em manhã, tarde e noite pelo horário local', () => {
    const r = agruparHorarios(
      [
        slot('2026-08-10T12:00:00.000Z', 'a', 'João'), // 09:00
        slot('2026-08-10T18:00:00.000Z', 'a', 'João'), // 15:00
        slot('2026-08-10T22:00:00.000Z', 'a', 'João'), // 19:00
      ],
      TZ, true,
    );
    expect(r.manha.map((h) => h.hora)).toEqual(['09:00']);
    expect(r.tarde.map((h) => h.hora)).toEqual(['15:00']);
    expect(r.noite.map((h) => h.hora)).toEqual(['19:00']);
  });

  it('com "qualquer barbeiro", três slots do mesmo horário viram uma ficha só', () => {
    const r = agruparHorarios(
      [
        slot('2026-08-10T12:00:00.000Z', 'a', 'João'),
        slot('2026-08-10T12:00:00.000Z', 'b', 'Pedro'),
        slot('2026-08-10T12:00:00.000Z', 'c', 'Ana'),
      ],
      TZ, false,
    );
    expect(r.manha).toHaveLength(1);
    expect(r.manha[0].quantidade).toBe(3);
  });

  it('com "qualquer barbeiro", a ficha NÃO fixa staffId — o servidor é que distribui', () => {
    const r = agruparHorarios(
      [slot('2026-08-10T12:00:00.000Z', 'a', 'João'), slot('2026-08-10T12:00:00.000Z', 'b', 'Pedro')],
      TZ, false,
    );
    expect(r.manha[0].staffId).toBeUndefined();
  });

  it('com barbeiro escolhido, mantém o staffId da ficha', () => {
    const r = agruparHorarios([slot('2026-08-10T12:00:00.000Z', 'a', 'João')], TZ, true);
    expect(r.manha[0].staffId).toBe('a');
  });

  it('ordena por horário dentro de cada bloco', () => {
    const r = agruparHorarios(
      [slot('2026-08-10T14:00:00.000Z', 'a', 'J'), slot('2026-08-10T12:00:00.000Z', 'a', 'J')],
      TZ, true,
    );
    expect(r.manha.map((h) => h.hora)).toEqual(['09:00', '11:00']);
  });

  it('dia sem horário devolve os três blocos vazios, não erro', () => {
    const r = agruparHorarios([], TZ, false);
    expect([r.manha, r.tarde, r.noite].every((b) => b.length === 0)).toBe(true);
  });
});
