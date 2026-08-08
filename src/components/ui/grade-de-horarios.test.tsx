// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GradeDeHorarios } from './grade-de-horarios';

const TZ = 'America/Sao_Paulo';
const slot = (iso: string, staffId: string, staffName: string) => ({ startAt: iso, staffId, staffName });

describe('GradeDeHorarios', () => {
  it('cada ficha carrega data-testid="slot" e data-hora — os dois ganchos do e2e', () => {
    render(
      <GradeDeHorarios
        slots={[slot('2026-08-10T12:00:00.000Z', 'a', 'João')]}
        timeZone={TZ}
        barbeiroEscolhido
        aoEscolher={vi.fn()}
      />,
    );
    const ficha = screen.getByTestId('slot');
    expect(ficha.getAttribute('data-hora')).toBe('09:00');
  });

  it('com "qualquer barbeiro", o mesmo horário aparece uma vez e diz quantos estão livres', () => {
    render(
      <GradeDeHorarios
        slots={[
          slot('2026-08-10T12:00:00.000Z', 'a', 'João'),
          slot('2026-08-10T12:00:00.000Z', 'b', 'Pedro'),
        ]}
        timeZone={TZ}
        barbeiroEscolhido={false}
        aoEscolher={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('slot')).toHaveLength(1);
    expect(screen.getByTestId('slot').textContent).toMatch(/2 livres/);
  });

  it('a ficha de "qualquer barbeiro" não manda staffId — o servidor é que distribui', () => {
    const aoEscolher = vi.fn();
    render(
      <GradeDeHorarios
        slots={[
          slot('2026-08-10T12:00:00.000Z', 'a', 'João'),
          slot('2026-08-10T12:00:00.000Z', 'b', 'Pedro'),
        ]}
        timeZone={TZ}
        barbeiroEscolhido={false}
        aoEscolher={aoEscolher}
      />,
    );
    screen.getByTestId('slot').click();
    expect(aoEscolher).toHaveBeenCalledWith({
      startAt: '2026-08-10T12:00:00.000Z',
      staffId: undefined,
      staffName: undefined,
    });
  });

  it('bloco sem horário some inteiro', () => {
    render(
      <GradeDeHorarios
        slots={[slot('2026-08-10T12:00:00.000Z', 'a', 'João')]}
        timeZone={TZ}
        barbeiroEscolhido
        aoEscolher={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Manhã' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Noite' })).toBeNull();
  });
});
