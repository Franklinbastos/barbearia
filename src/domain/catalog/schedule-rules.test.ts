import { describe, it, expect } from 'vitest';
import { validateWorkingBlocks, validateTimeOff } from './schedule-rules';

describe('validateWorkingBlocks', () => {
  it('aceita blocos separados em ordem', () => {
    expect(() =>
      validateWorkingBlocks([
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '13:00', endTime: '18:00' },
      ]),
    ).not.toThrow();
  });

  it('aceita blocos fora de ordem', () => {
    expect(() =>
      validateWorkingBlocks([
        { startTime: '13:00', endTime: '18:00' },
        { startTime: '09:00', endTime: '12:00' },
      ]),
    ).not.toThrow();
  });

  it('recusa bloco que termina antes de começar', () => {
    expect(() => validateWorkingBlocks([{ startTime: '18:00', endTime: '09:00' }])).toThrow(/antes/i);
  });

  it('recusa bloco de duração zero', () => {
    expect(() => validateWorkingBlocks([{ startTime: '09:00', endTime: '09:00' }])).toThrow(/antes/i);
  });

  it('recusa blocos sobrepostos', () => {
    expect(() =>
      validateWorkingBlocks([
        { startTime: '09:00', endTime: '13:00' },
        { startTime: '12:00', endTime: '18:00' },
      ]),
    ).toThrow(/sobrep/i);
  });

  it('aceita blocos encostados', () => {
    expect(() =>
      validateWorkingBlocks([
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '12:00', endTime: '18:00' },
      ]),
    ).not.toThrow();
  });
});

describe('validateTimeOff', () => {
  it('aceita intervalo válido', () => {
    expect(() =>
      validateTimeOff(new Date('2026-09-01T12:00:00Z'), new Date('2026-09-01T14:00:00Z')),
    ).not.toThrow();
  });

  it('recusa intervalo invertido', () => {
    expect(() =>
      validateTimeOff(new Date('2026-09-01T14:00:00Z'), new Date('2026-09-01T12:00:00Z')),
    ).toThrow(/antes/i);
  });
});
