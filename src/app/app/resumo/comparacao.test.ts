import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';

import { janelaAnterior, resolverPeriodo, type Janela } from '@/domain/indicadores/periodo';
import { compararComAnterior } from './comparacao';

const TZ = 'America/Sao_Paulo';
/** Segunda-feira, 10/08/2026, 10h — a semana corrente mal começou. */
const SEGUNDA_DE_MANHA = DateTime.fromISO('2026-08-10T10:00', { zone: TZ });

const SEMANA = resolverPeriodo({ timeZone: TZ, agora: SEGUNDA_DE_MANHA });
const ANTERIOR = janelaAnterior(SEMANA, TZ);

function comparar(args: {
  atualCents: number;
  anteriorCents: number;
  janela?: Janela;
  agora?: Date;
}) {
  return compararComAnterior({
    atualCents: args.atualCents,
    anteriorCents: args.anteriorCents,
    janela: args.janela ?? SEMANA,
    agora: args.agora ?? SEGUNDA_DE_MANHA.toJSDate(),
  });
}

describe('compararComAnterior', () => {
  it('sem base no período anterior não há selo — nada de "+100%" inventado', () => {
    expect(comparar({ atualCents: 5000, anteriorCents: 0 })).toBeUndefined();
  });

  it('numa janela em curso, o selo diz que a comparação é parcial', () => {
    // O defeito: numa segunda às 10h a semana corrente tem meia manhã e a
    // semana passada tem sete dias. O número comparado já vem recortado pelo
    // `recorteEquivalente`; o que falta é o texto não mentir sobre o que está
    // sendo comparado.
    const selo = comparar({ atualCents: 12000, anteriorCents: 10000 })!;
    expect(selo.valor).toBe('+20% que a semana passada até aqui');
    expect(selo.melhorou).toBe(true);
  });

  it('janela encerrada compara os dois períodos inteiros, sem ressalva', () => {
    const selo = comparar({
      atualCents: 8000,
      anteriorCents: 10000,
      janela: ANTERIOR,
    })!;
    expect(selo.valor).toBe('-20% que a semana passada');
    expect(selo.melhorou).toBe(false);
  });

  it('fala o nome de cada período na voz de quem conversa com o dono', () => {
    const hoje = resolverPeriodo({ periodo: 'hoje', timeZone: TZ, agora: SEGUNDA_DE_MANHA });
    const mes = resolverPeriodo({ periodo: 'mes', timeZone: TZ, agora: SEGUNDA_DE_MANHA });
    const livre = resolverPeriodo({
      periodo: 'livre',
      de: '2026-01-05',
      ate: '2026-01-11',
      timeZone: TZ,
      agora: SEGUNDA_DE_MANHA,
    });

    expect(comparar({ atualCents: 100, anteriorCents: 100, janela: hoje })!.valor).toContain(
      'que ontem',
    );
    expect(comparar({ atualCents: 100, anteriorCents: 100, janela: mes })!.valor).toContain(
      'que o mês passado',
    );
    expect(comparar({ atualCents: 100, anteriorCents: 100, janela: livre })!.valor).toContain(
      'que o período anterior',
    );
  });

  it('empate é "melhorou": ficar igual não é piorar', () => {
    expect(comparar({ atualCents: 5000, anteriorCents: 5000 })!.melhorou).toBe(true);
  });
});
