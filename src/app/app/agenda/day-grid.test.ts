import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildDayList, DayGrid, type AgendaAppointment, type AgendaStaff } from './day-grid';

const TZ = 'America/Sao_Paulo';

const EQUIPE: AgendaStaff[] = [
  { id: 'st-joao', name: 'João' },
  { id: 'st-maria', name: 'Maria' },
];

function agendamento(over: Partial<AgendaAppointment> & { id: string; staffId: string; hora: string }): AgendaAppointment {
  const { hora, ...resto } = over;
  const inicio = new Date(`2026-09-09T${hora}:00.000Z`);
  return {
    startAt: inicio,
    endAt: new Date(inicio.getTime() + 30 * 60_000),
    status: 'BOOKED',
    origin: 'PUBLIC',
    serviceName: 'Corte',
    servicePriceCents: 4000,
    customerName: 'Cliente',
    customerPhone: '11999998888',
    ...resto,
  };
}

describe('buildDayList', () => {
  it('devolve uma lista única ordenada por horário, e não uma coluna por barbeiro', () => {
    const lista = buildDayList(
      [
        agendamento({ id: 'a3', staffId: 'st-joao', hora: '17:00' }),
        agendamento({ id: 'a1', staffId: 'st-maria', hora: '13:00' }),
        agendamento({ id: 'a2', staffId: 'st-joao', hora: '14:00' }),
      ],
      EQUIPE,
    );

    expect(lista.map((i) => i.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('põe o nome do barbeiro em cada item — é o que o cartão precisa mostrar', () => {
    const lista = buildDayList(
      [
        agendamento({ id: 'a1', staffId: 'st-maria', hora: '13:00' }),
        agendamento({ id: 'a2', staffId: 'st-joao', hora: '14:00' }),
      ],
      EQUIPE,
    );

    expect(lista.map((i) => i.staffName)).toEqual(['Maria', 'João']);
  });

  it('desempata horário igual pelo nome do barbeiro, para a ordem não variar entre renders', () => {
    const lista = buildDayList(
      [
        agendamento({ id: 'a-maria', staffId: 'st-maria', hora: '13:00' }),
        agendamento({ id: 'a-joao', staffId: 'st-joao', hora: '13:00' }),
      ],
      EQUIPE,
    );

    expect(lista.map((i) => i.id)).toEqual(['a-joao', 'a-maria']);
  });

  it('não some com agendamento de barbeiro fora da lista ativa', () => {
    const lista = buildDayList(
      [agendamento({ id: 'a1', staffId: 'st-desligado', hora: '13:00' })],
      EQUIPE,
    );

    expect(lista).toHaveLength(1);
    expect(lista[0].staffName.length).toBeGreaterThan(0);
  });

  it('dia sem agendamento vira lista vazia, não erro', () => {
    expect(buildDayList([], EQUIPE)).toEqual([]);
  });
});

describe('DayGrid', () => {
  const marcacoes = [
    agendamento({ id: 'a2', staffId: 'st-maria', hora: '17:00', customerName: 'Ana' }),
    agendamento({ id: 'a1', staffId: 'st-joao', hora: '13:00', customerName: 'Bruno' }),
    agendamento({ id: 'a3', staffId: 'st-joao', hora: '18:00', status: 'CANCELED', customerName: 'Caio' }),
  ];
  const html = renderToStaticMarkup(
    createElement(DayGrid, { appointments: marcacoes, staffList: EQUIPE, timeZone: TZ }),
  );

  it('mostra o nome do barbeiro em cada cartão', () => {
    expect(html).toContain('João');
    expect(html).toContain('Maria');
  });

  it('lista em ordem de horário, misturando os barbeiros', () => {
    expect(html.indexOf('Bruno')).toBeLessThan(html.indexOf('Ana'));
    expect(html.indexOf('Ana')).toBeLessThan(html.indexOf('Caio'));
  });

  it('não empilha uma coluna por barbeiro', () => {
    // A lista é o próprio container do dia: sem título por barbeiro e sem
    // coluna de largura fixa que vira pilha no celular.
    expect(html.startsWith('<ul')).toBe(true);
    expect(html).not.toContain('<h3>');
    expect(html).not.toContain('1 1 260px');
  });

  it('traduz o estado do agendamento em vez de mostrar o enum do banco', () => {
    expect(html).toContain('Cancelado');
    expect(html).not.toContain('CANCELED');
    expect(html).not.toContain('BOOKED');
  });

  it('mostra o horário no fuso da barbearia', () => {
    expect(html).toContain('10:00');
  });

  it('avisa quando o dia está vazio', () => {
    const vazio = renderToStaticMarkup(
      createElement(DayGrid, { appointments: [], staffList: EQUIPE, timeZone: TZ }),
    );
    expect(vazio).toContain('Nenhum agendamento');
  });
});
