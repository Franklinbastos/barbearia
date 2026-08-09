import { describe, it, expect } from 'vitest';
import * as luxon from 'luxon';
import { computeAvailability, parseTimeToMinutes } from './compute';
import type { AvailabilityInput } from './types';

const BASE: AvailabilityInput = {
  date: '2026-09-01',
  timeZone: 'America/Sao_Paulo',
  slotMinutes: 30,
  minLeadMinutes: 0,
  serviceDurationMinutes: 30,
  workingBlocks: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
  busy: [],
  now: new Date('2026-08-01T00:00:00Z'),
};

function horarios(slots: { start: Date }[], timeZone = 'America/Sao_Paulo') {
  return slots.map((s) =>
    s.start.toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }),
  );
}

/** Instante absoluto de um horário local do dia da BASE (São Paulo, UTC-3). */
function local(hora: string): Date {
  return new Date(`2026-09-01T${hora}:00-03:00`);
}

/** Bloco de expediente a partir de horas locais, para o dia caber numa linha. */
function bloco(inicio: number, fim: number) {
  return { startMinute: inicio * 60, endMinute: fim * 60 };
}

describe('parseTimeToMinutes', () => {
  it('converte hora com segundos', () => {
    expect(parseTimeToMinutes('09:30:00')).toBe(570);
  });

  it('converte hora sem segundos', () => {
    expect(parseTimeToMinutes('14:00')).toBe(840);
  });
});

describe('computeAvailability — grade', () => {
  it('gera um slot por intervalo quando serviço e grade têm a mesma duração', () => {
    const slots = computeAvailability(BASE);
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('ocupa dois slots quando o serviço é maior que a grade', () => {
    const slots = computeAvailability({ ...BASE, serviceDurationMinutes: 45 });
    // A grade em si morre nas 11:00 — 11:30 ocuparia até 12:30 e não cabe.
    // As 11:15 são o encaixe na ponta do fim do expediente (§3.1 do spec).
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:15']);
    expect(slots[0].end.getTime() - slots[0].start.getTime()).toBe(60 * 60 * 1000);
  });

  it('descarta o candidato que não cabe no fim do bloco', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      workingBlocks: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
    });
    expect(horarios(slots)).toEqual(['09:00']);
  });

  it('não emenda dois blocos por cima do intervalo de almoço', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      workingBlocks: [
        { startMinute: 11 * 60, endMinute: 12 * 60 },
        { startMinute: 13 * 60, endMinute: 14 * 60 },
      ],
    });
    expect(horarios(slots)).toEqual(['11:00', '13:00']);
  });

  it('devolve lista vazia quando o barbeiro não trabalha no dia', () => {
    expect(computeAvailability({ ...BASE, workingBlocks: [] })).toEqual([]);
  });

  it('recusa slotMinutes inválido', () => {
    expect(() => computeAvailability({ ...BASE, slotMinutes: 0 })).toThrow(/slotMinutes/);
  });

  it('recusa duração de serviço inválida', () => {
    expect(() => computeAvailability({ ...BASE, serviceDurationMinutes: 0 })).toThrow(/duração/i);
  });
});

describe('computeAvailability — colisões', () => {
  it('remove os horários cobertos por um agendamento existente', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T13:00:00Z'), end: new Date('2026-09-01T13:30:00Z') }],
    });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:30', '11:00', '11:30']);
  });

  it('remove os horários cobertos por um bloqueio parcial no meio do dia', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T13:15:00Z'), end: new Date('2026-09-01T14:15:00Z') }],
    });
    // O bloqueio das 10:15 às 11:15 tira 10:00 e 10:30 da grade e deixa dois
    // espaços livres; 09:45 e 11:15 são as pontas deles (§3.1 do spec).
    expect(horarios(slots)).toEqual(['09:00', '09:30', '09:45', '11:15', '11:30']);
  });

  it('remove os horários que um serviço longo atravessaria', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      busy: [{ start: new Date('2026-09-01T14:00:00Z'), end: new Date('2026-09-01T14:30:00Z') }],
    });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00']);
  });

  it('devolve lista vazia quando o dia está inteiramente ocupado', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T12:00:00Z'), end: new Date('2026-09-01T15:00:00Z') }],
    });
    expect(slots).toEqual([]);
  });
});

describe('computeAvailability — antecedência mínima', () => {
  it('corta os horários que estão dentro da antecedência mínima', () => {
    const slots = computeAvailability({
      ...BASE,
      now: new Date('2026-09-01T12:40:00Z'),
      minLeadMinutes: 60,
    });
    expect(horarios(slots)).toEqual(['11:00', '11:30']);
  });

  it('não oferece horário no passado mesmo com antecedência zero', () => {
    const slots = computeAvailability({ ...BASE, now: new Date('2026-09-01T14:00:00Z') });
    expect(horarios(slots)).toEqual(['11:00', '11:30']);
  });
});

describe('computeAvailability — fuso e horário de verão', () => {
  it('respeita o horário local, não o do servidor', () => {
    const slots = computeAvailability({
      ...BASE,
      timeZone: 'America/Manaus',
      workingBlocks: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
    });
    expect(slots[0].start.toISOString()).toBe('2026-09-01T13:00:00.000Z');
  });

  it('não oferece horário que não existe no dia em que o relógio adianta', () => {
    const slots = computeAvailability({
      ...BASE,
      date: '2026-03-08',
      timeZone: 'America/New_York',
      workingBlocks: [{ startMinute: 1 * 60, endMinute: 5 * 60 }],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const locais = horarios(slots, 'America/New_York');
    expect(locais).not.toContain('02:00');
    expect(locais).not.toContain('02:30');
    expect(locais).toContain('01:00');
    expect(locais).toContain('03:00');
  });

  it('nenhum horário passa do fim do expediente no dia em que o relógio adianta', () => {
    // O relógio de parede anda 60 minutos a mais que o tempo real, então somar
    // minutos locais em cima do instante de início erra por uma hora. Bloco
    // 01:02 → 03:59 com serviço de 168: pela soma local, 01:02 caberia
    // (62 + 168 = 230 ≤ 239); na vida real termina 04:50, quase uma hora depois
    // de fechar.
    const slots = computeAvailability({
      ...BASE,
      date: '2026-03-08',
      timeZone: 'America/New_York',
      slotMinutes: 15,
      serviceDurationMinutes: 168,
      workingBlocks: [{ startMinute: 62, endMinute: 239 }],
      now: new Date('2026-03-01T00:00:00Z'),
    });
    expect(slots).toEqual([]);
  });

  it('a grade também para no fim do expediente no dia em que o relógio adianta', () => {
    // Mesma aritmética, primeira passagem: bloco 01:00 → 02:30 com serviço de
    // 30 na grade de 30. As 01:30 terminariam 03:00 — meia hora depois de
    // fechar, porque as 02:00 não existem nesse dia.
    const slots = computeAvailability({
      ...BASE,
      date: '2026-03-08',
      timeZone: 'America/New_York',
      workingBlocks: [{ startMinute: 60, endMinute: 150 }],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(horarios(slots, 'America/New_York')).toEqual(['01:00']);
  });

  it('não encurta o expediente no dia em que o relógio atrasa', () => {
    // O contrário do caso acima: o dia tem 25 horas de parede, e o atendimento
    // que começa 01:30 EDT termina 01:00 EST — antes, no relógio, do que
    // começou. Continua dentro do bloco e não pode ser descartado.
    const slots = computeAvailability({
      ...BASE,
      date: '2026-11-01',
      timeZone: 'America/New_York',
      workingBlocks: [{ startMinute: 60, endMinute: 180 }],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const inicios = slots.map((s) => s.start.toISOString());
    // 01:30 EDT = 05:30Z; termina 06:00Z, que é 01:00 EST.
    expect(inicios).toContain('2026-11-01T05:30:00.000Z');
    expect(slots.length).toBeGreaterThan(2);
  });

  it('nenhum horário passa do fim do expediente, varrendo os dois dias de virada', () => {
    const { DateTime } = luxon;
    for (const date of ['2026-03-08', '2026-11-01']) {
      for (const startMinute of [0, 47, 60, 62, 90, 120, 150]) {
        for (const endMinute of [150, 180, 239, 300, 1440]) {
          if (endMinute <= startMinute) continue;
          for (const serviceDurationMinutes of [30, 45, 90, 168, 200]) {
            const slots = computeAvailability({
              ...BASE,
              date,
              timeZone: 'America/New_York',
              slotMinutes: 15,
              serviceDurationMinutes,
              workingBlocks: [{ startMinute, endMinute }],
              now: new Date('2026-01-01T00:00:00Z'),
            });
            for (const slot of slots) {
              const fim = DateTime.fromJSDate(slot.end, { zone: 'America/New_York' });
              const dias = fim.startOf('day').diff(
                DateTime.fromISO(date, { zone: 'America/New_York' }).startOf('day'), 'days',
              ).days;
              const minutoFim = dias * 1440 + fim.hour * 60 + fim.minute;
              expect(
                minutoFim,
                `${date} bloco ${startMinute}-${endMinute} serviço ${serviceDurationMinutes}`,
              ).toBeLessThanOrEqual(endMinute);
            }
          }
        }
      }
    }
  });

  it('mantém a grade coerente no dia em que o relógio atrasa', () => {
    const slots = computeAvailability({
      ...BASE,
      date: '2026-11-01',
      timeZone: 'America/New_York',
      workingBlocks: [{ startMinute: 1 * 60, endMinute: 3 * 60 }],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const instantes = slots.map((s) => s.start.getTime());
    expect(new Set(instantes).size).toBe(instantes.length);
    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));
  });
});

describe('computeAvailability — encaixe nas pontas', () => {
  it('oferece as duas pontas do espaço livre, e nada entre elas', () => {
    // O exemplo do §3.2 do spec: espaço das 15:00 às 16:00, serviço de 45.
    // A grade sozinha só enxerga 15:00; a ponta do fim recupera 15:15.
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 45,
      workingBlocks: [bloco(14, 17)],
      busy: [
        { start: local('14:00'), end: local('15:00') },
        { start: local('16:00'), end: local('17:00') },
      ],
    });
    expect(horarios(slots)).toEqual(['15:00', '15:15']);
    expect(slots[1].end).toEqual(local('16:00'));
  });

  it('gera um único candidato quando o serviço cabe exatamente no espaço', () => {
    // Espaço das 10:20 às 11:05: 45 minutos para um serviço de 45. As duas
    // pontas caem no mesmo minuto e não podem virar dois horários iguais.
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 45,
      busy: [
        { start: local('09:00'), end: local('10:20') },
        { start: local('11:05'), end: local('12:00') },
      ],
    });
    expect(horarios(slots)).toEqual(['10:20']);
  });

  it('não gera candidato no espaço em que o serviço não cabe', () => {
    // Mesmo dia do teste anterior, com o espaço encurtado para 40 minutos.
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 45,
      busy: [
        { start: local('09:00'), end: local('10:20') },
        { start: local('11:00'), end: local('12:00') },
      ],
    });
    expect(slots).toEqual([]);
  });

  it('no dia sem ocupado, a ponta do fim do expediente entra na lista', () => {
    // Bloco das 09:00 às 12:00, grade 30, serviço 45 (ocupa 60 na grade).
    // A grade morre nas 11:00; a ponta do fim acrescenta 11:15 → 12:00.
    const slots = computeAvailability({ ...BASE, serviceDurationMinutes: 45 });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:15']);
    expect(slots[5].end).toEqual(local('12:00'));

    // Quando o serviço tem o tamanho da grade, as duas pontas do bloco já
    // estão na grade e nada é acrescentado.
    expect(horarios(computeAvailability(BASE)))
      .toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('oferece o rabo que um encaixe anterior deixou fora da grade', () => {
    // Walk-in das 14:35 às 14:55 desalinha o resto do dia. Sem a segunda
    // passagem, o próximo horário seria 15:00 e as 14:55 ficariam mortas.
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 20,
      workingBlocks: [bloco(14, 18)],
      busy: [{ start: local('14:35'), end: local('14:55') }],
    });
    expect(horarios(slots)).toEqual([
      '14:00', '14:15', '14:55', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '17:40',
    ]);
  });

  it('a ponta do fim respeita a antecedência mínima', () => {
    const dia = {
      ...BASE,
      serviceDurationMinutes: 45,
      minLeadMinutes: 30,
      workingBlocks: [bloco(14, 17)],
      busy: [
        { start: local('14:00'), end: local('15:00') },
        { start: local('16:00'), end: local('17:00') },
      ],
    };

    // Às 14:40, a antecedência já derrubou as 15:00 e a ponta segura o dia.
    expect(horarios(computeAvailability({ ...dia, now: local('14:40') }))).toEqual(['15:15']);

    // Às 14:50, nem a ponta escapa: 15:15 está dentro dos 30 minutos.
    expect(computeAvailability({ ...dia, now: local('14:50') })).toEqual([]);
  });

  it('nenhum candidato colide com o que já está ocupado', () => {
    const busy = [
      { start: local('09:50'), end: local('10:30') },
      { start: local('12:10'), end: local('13:00') },
      { start: local('15:05'), end: local('16:20') },
    ];
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 40,
      workingBlocks: [bloco(9, 18)],
      busy,
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      for (const ocupado of busy) {
        expect(slot.start < ocupado.end && ocupado.start < slot.end).toBe(false);
      }
    }
    // As pontas de cada espaço têm que estar lá: 10:30 (rabo do primeiro
    // ocupado), 11:30 (encostado no começo do segundo) e 16:20.
    expect(horarios(slots)).toEqual(expect.arrayContaining(['10:30', '11:30', '16:20']));
  });

  it('nenhum candidato escapa do bloco nem emenda por cima do almoço', () => {
    // Ocupado das 11:40 às 13:20 atravessa o almoço. Sobra a ponta do fim do
    // bloco da manhã (11:00 → 11:40) e a do começo do que resta da tarde.
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 40,
      workingBlocks: [bloco(11, 12), bloco(13, 14)],
      busy: [{ start: local('11:40'), end: local('13:20') }],
    });

    expect(horarios(slots)).toEqual(['11:00', '13:20']);
    expect(slots[0].end).toEqual(local('11:40'));
    expect(slots[1].end).toEqual(local('14:00'));
  });

  it('mantém o resultado ordenado e sem duplicata', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 25,
      workingBlocks: [bloco(9, 12), bloco(13, 19)],
      busy: [
        { start: local('09:20'), end: local('09:55') },
        { start: local('10:40'), end: local('11:00') },
        { start: local('13:00'), end: local('14:10') },
        { start: local('16:05'), end: local('16:35') },
        { start: local('18:00'), end: local('18:20') },
      ],
    });

    const instantes = slots.map((s) => s.start.getTime());
    expect(instantes.length).toBeGreaterThan(10);
    expect(new Set(instantes).size).toBe(instantes.length);
    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));
  });

  it('continua oferecendo tudo o que a grade sozinha oferecia', () => {
    // Cada cenário traz o resultado que a primeira passagem já dava antes da
    // segunda existir — são os mesmos literais dos testes de grade e colisão
    // acima. A segunda passagem só pode acrescentar.
    const cenarios: { entrada: AvailabilityInput; grade: string[] }[] = [
      { entrada: BASE, grade: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'] },
      {
        entrada: { ...BASE, serviceDurationMinutes: 45 },
        grade: ['09:00', '09:30', '10:00', '10:30', '11:00'],
      },
      {
        entrada: {
          ...BASE,
          busy: [{ start: local('10:00'), end: local('10:30') }],
        },
        grade: ['09:00', '09:30', '10:30', '11:00', '11:30'],
      },
      {
        entrada: {
          ...BASE,
          serviceDurationMinutes: 60,
          busy: [{ start: local('11:00'), end: local('11:30') }],
        },
        grade: ['09:00', '09:30', '10:00'],
      },
      {
        entrada: {
          ...BASE,
          serviceDurationMinutes: 20,
          workingBlocks: [bloco(14, 18)],
          busy: [{ start: local('14:35'), end: local('14:55') }],
        },
        grade: ['14:00', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'],
      },
    ];

    for (const { entrada, grade } of cenarios) {
      const completo = horarios(computeAvailability(entrada));
      expect(completo).toEqual(expect.arrayContaining(grade));
    }
  });
});

describe('computeAvailability — pontas em minuto cheio', () => {
  it('não oferece horário com segundo quebrado quando o ocupado termina fora do minuto', () => {
    // Encaixe de balcão pode terminar em segundo quebrado. A ponta que nasce
    // dali não pode virar "13:15" na tela e 13:15:37 no banco.
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 20,
      busy: [{ start: new Date('2026-09-01T13:00:00Z'), end: new Date('2026-09-01T13:15:37Z') }],
    });
    const quebrados = slots.filter((s) => s.start.getSeconds() !== 0 || s.start.getMilliseconds() !== 0);
    expect(quebrados).toEqual([]);
  });

  it('a ponta que antecede um ocupado não invade o ocupado por segundos', () => {
    const inicioDoOcupado = new Date('2026-09-01T13:40:23Z');
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 20,
      busy: [{ start: inicioDoOcupado, end: new Date('2026-09-01T14:00:00Z') }],
    });

    // Quem começa antes do ocupado tem que terminar antes dele — nem um segundo
    // por cima. É aqui que o arredondamento para o minuto cheio anterior conta.
    const anteriores = slots.filter((s) => s.start < inicioDoOcupado);
    expect(anteriores.length).toBeGreaterThan(0);
    for (const s of anteriores) {
      expect(s.end.getTime()).toBeLessThanOrEqual(inicioDoOcupado.getTime());
    }

    // E todo horário oferecido começa em minuto cheio.
    expect(slots.filter((s) => s.start.getSeconds() !== 0)).toEqual([]);
  });
});
