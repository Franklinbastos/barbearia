import { describe, it, expect } from 'vitest';
import {
  avisoDeHorarioLivre,
  deslocarHora,
  horaDeAgoraArredondada,
  resolverInicioDoEncaixe,
} from './encaixe';

const TZ = 'America/Sao_Paulo';
const DIA = '2026-09-07';

/** 14:05 em São Paulo é 17:05 UTC — a conta que o balcão não pode errar. */
const QUATORZE_E_CINCO = '2026-09-07T17:05:00.000Z';

describe('resolverInicioDoEncaixe', () => {
  it('converte a hora digitada usando o fuso da barbearia', () => {
    const inicio = resolverInicioDoEncaixe({ date: DIA, hora: '14:05', timeZone: TZ });
    expect(inicio?.toISOString()).toBe(QUATORZE_E_CINCO);
  });

  it('aceita o instante que veio da grade', () => {
    const inicio = resolverInicioDoEncaixe({ startAt: QUATORZE_E_CINCO, timeZone: TZ });
    expect(inicio?.toISOString()).toBe(QUATORZE_E_CINCO);
  });

  it('a hora digitada manda quando as duas vêm no formulário', () => {
    const inicio = resolverInicioDoEncaixe({
      startAt: '2026-09-07T13:00:00.000Z', date: DIA, hora: '14:05', timeZone: TZ,
    });
    expect(inicio?.toISOString()).toBe(QUATORZE_E_CINCO);
  });

  it('aceita hora com segundos, como alguns navegadores mandam', () => {
    const inicio = resolverInicioDoEncaixe({ date: DIA, hora: '14:05:00', timeZone: TZ });
    expect(inicio?.toISOString()).toBe(QUATORZE_E_CINCO);
  });

  it('devolve nulo para hora inválida', () => {
    for (const hora of ['99:99', '25:00', 'abc', '14', '']) {
      expect(resolverInicioDoEncaixe({ date: DIA, hora, timeZone: TZ }), `hora ${hora}`)
        .toBeNull();
    }
  });

  it('devolve nulo para dia inválido', () => {
    expect(resolverInicioDoEncaixe({ date: '2026-13-40', hora: '14:05', timeZone: TZ })).toBeNull();
    expect(resolverInicioDoEncaixe({ date: '', hora: '14:05', timeZone: TZ })).toBeNull();
  });

  it('devolve nulo quando nada foi escolhido', () => {
    expect(resolverInicioDoEncaixe({ timeZone: TZ })).toBeNull();
    expect(resolverInicioDoEncaixe({ startAt: 'nada disso', timeZone: TZ })).toBeNull();
  });
});

describe('avisoDeHorarioLivre', () => {
  const grade = [
    { startAt: '2026-09-07T17:00:00.000Z' }, // 14:00 local
    { startAt: '2026-09-07T17:30:00.000Z' }, // 14:30 local
  ];

  it('avisa, em pt-BR, quando a hora digitada está fora da grade', () => {
    const aviso = avisoDeHorarioLivre('14:05', grade, TZ);
    expect(aviso).toMatch(/fora da grade/i);
    expect(aviso).toContain('14:05');
  });

  it('não avisa quando a hora digitada coincide com a grade', () => {
    expect(avisoDeHorarioLivre('14:30', grade, TZ)).toBeNull();
  });

  it('não avisa antes de o atendente digitar', () => {
    expect(avisoDeHorarioLivre('', grade, TZ)).toBeNull();
  });

  it('avisa quando a grade não carregou nenhum horário', () => {
    expect(avisoDeHorarioLivre('14:05', [], TZ)).toMatch(/fora da grade/i);
  });
});

describe('horaDeAgoraArredondada', () => {
  it('arredonda para baixo em 5 minutos, no fuso da barbearia', () => {
    // 17:07 UTC é 14:07 em São Paulo — o mostrador do balcão mostra 14:05.
    expect(horaDeAgoraArredondada(new Date('2026-09-07T17:07:00Z'), TZ)).toBe('14:05');
  });

  it('hora cheia continua hora cheia', () => {
    expect(horaDeAgoraArredondada(new Date('2026-09-07T17:00:00Z'), TZ)).toBe('14:00');
  });

  it('nunca arredonda para cima — 14:09 não vira 14:10', () => {
    expect(horaDeAgoraArredondada(new Date('2026-09-07T17:09:59Z'), TZ)).toBe('14:05');
  });
});

describe('deslocarHora', () => {
  it('anda cinco minutos para frente e para trás', () => {
    expect(deslocarHora('14:05', 5)).toBe('14:10');
    expect(deslocarHora('14:05', -5)).toBe('14:00');
  });

  it('vira a hora sem estragar o relógio', () => {
    expect(deslocarHora('13:55', 5)).toBe('14:00');
    expect(deslocarHora('14:00', -5)).toBe('13:55');
  });

  it('para nas pontas do dia em vez de pular para o dia seguinte', () => {
    // O encaixe é sempre no dia mostrado: virar a meia-noite marcaria o cliente
    // no dia errado sem o atendente perceber.
    expect(deslocarHora('23:55', 5)).toBe('23:55');
    expect(deslocarHora('00:00', -5)).toBe('00:00');
  });

  it('devolve o que recebeu quando a hora não é hora', () => {
    expect(deslocarHora('', 5)).toBe('');
    expect(deslocarHora('99:99', 5)).toBe('99:99');
  });
});
