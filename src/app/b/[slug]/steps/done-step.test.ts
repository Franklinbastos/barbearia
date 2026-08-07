import { describe, it, expect } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { DoneStep } from './done-step';
import type { Resultado } from '../types';

/** Concatena o texto de uma árvore de elementos React, sem precisar de DOM. */
function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === 'boolean') return '';
  if (typeof no === 'string' || typeof no === 'number') return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join('');
  if (isValidElement(no)) {
    const props = no.props as { children?: ReactNode };
    return textoDe(props.children);
  }
  return '';
}

const RESULTADO: Resultado = {
  appointmentId: 'ag-1',
  manageUrl: 'https://exemplo.test/agendamento/tok',
  // 21:30 de segunda-feira, 7 de setembro, em São Paulo — já é dia 8 em UTC.
  startAt: '2026-09-08T00:30:00.000Z',
  staffName: 'João',
};

describe('DoneStep', () => {
  it('mostra o dia no fuso da barbearia, não o dia do ISO em UTC', () => {
    const texto = textoDe(DoneStep({ resultado: RESULTADO, timeZone: 'America/Sao_Paulo' }));

    expect(texto).toContain('21:30');
    expect(texto).toMatch(/seg/i);
    expect(texto).toContain('7 de set');
    expect(texto).not.toContain('8 de set');
    expect(texto).not.toMatch(/ter/i);
  });

  it('mostra dia e hora coerentes num horário de manhã', () => {
    const texto = textoDe(
      DoneStep({
        resultado: { ...RESULTADO, startAt: '2026-09-07T12:00:00.000Z' },
        timeZone: 'America/Sao_Paulo',
      }),
    );

    expect(texto).toContain('09:00');
    expect(texto).toContain('7 de set');
  });

  it('mostra o nome do barbeiro e o link de gestão', () => {
    const elemento = DoneStep({ resultado: RESULTADO, timeZone: 'America/Sao_Paulo' });
    expect(textoDe(elemento)).toContain('João');
  });
});
