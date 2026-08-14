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
  /**
   * O cancelado tem uma hora de duração de propósito: acima de 45 min o cartão
   * sai na forma `completo`, que é a única que mostra o telefone na linha — e é
   * o telefone que a asserção de opacidade existe para proteger.
   */
  const cancelado = agendamento({
    id: 'a3',
    staffId: 'st-joao',
    hora: '18:00',
    status: 'CANCELED',
    customerName: 'Caio',
    endAt: new Date('2026-09-09T19:00:00.000Z'),
  });
  const marcacoes = [
    agendamento({ id: 'a2', staffId: 'st-maria', hora: '17:00', customerName: 'Ana' }),
    agendamento({ id: 'a1', staffId: 'st-joao', hora: '13:00', customerName: 'Bruno' }),
    cancelado,
  ];
  /** O dia mostrado é 2026-09-09 e "hoje" é outro: sem régua do agora no meio. */
  const CONTEXTO = {
    staffList: EQUIPE,
    timeZone: TZ,
    dataISO: '2026-09-09',
    hojeISO: '2026-09-01',
    agoraISO: '2026-09-01T12:00:00.000Z',
  };
  const html = renderToStaticMarkup(
    createElement(DayGrid, { appointments: marcacoes, ...CONTEXTO }),
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
    expect(html).toContain('<ol');
    expect(html).not.toContain('<h3>');
    expect(html).not.toContain('1 1 260px');
  });

  it('o cancelado troca de tinta em vez de perder opacidade', () => {
    // `opacity: 0.5` apagava o telefone junto com o resto, e o telefone é o que
    // se procura justamente num horário que deu errado.
    //
    // A asserção procura opacidade *aplicada* — em `style` ou em utilitário
    // `opacity-<n>` —, não a palavra solta. Em 13/08/2026 o `disabled:opacity-50`
    // do base-nova voltou junto com o resto da aparência da lib, e ele aparece
    // no `class` de todo botão da linha; por isso a variante `disabled:` fica de
    // fora da busca. Ela é condicional, só pinta quando o botão está
    // desabilitado, e nenhum botão desta linha está.
    //
    // A varredura é **só no cartão cancelado**, e não na lista inteira, desde
    // 14/08/2026: o cartão em aberto ganhou `pointer-fine:opacity-0` para
    // recolher "Compareceu" no desktop, que é recolhimento condicional e não
    // tinta de estado. O que este teste protege é o estado — o cancelado não
    // pode desbotar —, e o cancelado não tem esse bloco.
    const soCancelado = renderToStaticMarkup(
      createElement(DayGrid, { appointments: [cancelado], ...CONTEXTO }),
    );
    expect(soCancelado).not.toMatch(/opacity\s*:/);
    expect(soCancelado).not.toMatch(/(?<!disabled:)\bopacity-(?!100\b)\d/);
    // a distinção continua sendo de tinta: fundo cinza, barra de perigo, nome
    // riscado em tinta-3 — e o telefone intacto, que era o objetivo de tudo isso
    expect(soCancelado).toContain('--superficie');
    expect(soCancelado).toContain('line-through');
    expect(soCancelado).toContain('11999998888');
  });

  it('deixa "Compareceu" na linha e tira "Cancelar" de perto dele', () => {
    expect(html).toContain('Compareceu');
    expect(html).not.toContain('>Cancelar<');
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
    const vazio = renderToStaticMarkup(createElement(DayGrid, { appointments: [], ...CONTEXTO }));
    expect(vazio).toContain('Nenhum agendamento');
  });
});

describe('DayGrid — o vão livre', () => {
  /** 10:00 e 12:00 no fuso da loja, com 90 minutos de buraco entre eles. */
  const COM_BURACO = [
    agendamento({ id: 'a1', staffId: 'st-joao', hora: '13:00', customerName: 'Bruno' }),
    agendamento({ id: 'a2', staffId: 'st-joao', hora: '15:00', customerName: 'Ana' }),
  ];

  const CONTEXTO = {
    staffList: EQUIPE,
    timeZone: TZ,
    dataISO: '2026-09-09',
    hojeISO: '2026-09-01',
    agoraISO: '2026-09-01T12:00:00.000Z',
  };

  const desenhar = (props: Partial<Parameters<typeof DayGrid>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(DayGrid, { appointments: COM_BURACO, ...CONTEXTO, ...props }),
    );

  it('oferece o buraco entre dois atendimentos como ação, e não como texto', () => {
    // é o gesto primário de agendar em Fresha, Square, Vagaro, Acuity e Cal.com
    const html = desenhar();
    expect(html).toContain('aria-label="Encaixar às 10:30 · 1 h 30 min livre com João"');
    // a faixa cai ENTRE os dois cartões que a criaram, não no fim da lista
    expect(html.indexOf('Bruno')).toBeLessThan(html.indexOf('Encaixar às 10:30'));
    expect(html.indexOf('Encaixar às 10:30')).toBeLessThan(html.indexOf('Ana'));
  });

  it('a faixa é botão, com alvo de 44px', () => {
    // `<div onClick>` não recebe Tab nem é anunciado; 44px é a régua de toque
    const html = desenhar();
    expect(html).toMatch(/<button[^>]+aria-label="Encaixar às 10:30/);
    expect(html).toContain('min-h-11');
  });

  it('buraco menor que o serviço mais curto não vira faixa', () => {
    // faixa de cinco minutos enche a tela e não leva a lugar nenhum
    const curto = [
      agendamento({ id: 'a1', staffId: 'st-joao', hora: '13:00' }),
      agendamento({ id: 'a2', staffId: 'st-joao', hora: '13:45' }),
    ];
    expect(desenhar({ appointments: curto })).not.toContain('Encaixar às');
  });

  it('o piso vem de fora: com serviço mínimo de 2h, 90 minutos não bastam', () => {
    expect(desenhar({ duracaoMinima: 120 })).not.toContain('Encaixar às');
  });

  it('com um barbeiro só, a faixa não repete o nome dele', () => {
    const html = desenhar({ staffList: [EQUIPE[0]] });
    expect(html).toContain('aria-label="Encaixar às 10:30 · 1 h 30 min livre"');
  });

  it('buraco que já passou não vira faixa', () => {
    // encaixar às 10:30 quando são 14:00 marcaria cliente no passado
    const html = desenhar({ hojeISO: '2026-09-09', agoraISO: '2026-09-09T17:00:00.000Z' });
    expect(html).not.toContain('Encaixar às');
  });

  it('buraco em curso é oferecido a partir de agora, com o que sobra dele', () => {
    // às 10:59 o buraco das 10:30 às 12:00 ainda vende uma hora; oferecer
    // "10:30 · 1 h 30 min" erraria a hora e o tamanho de uma vez. A hora sobe
    // para o passo de ±5 da folha: 11:00, nunca 10:59.
    const html = desenhar({ hojeISO: '2026-09-09', agoraISO: '2026-09-09T13:59:00.000Z' });
    expect(html).toContain('aria-label="Encaixar às 11:00 · 1 h livre com João"');
    // e a régua do agora fica acima da faixa, que é futuro
    expect(html.indexOf('aria-label="Agora"')).toBeLessThan(html.indexOf('Encaixar às'));
  });
});
