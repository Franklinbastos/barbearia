import { describe, it, expect } from 'vitest';
import { calcularPerfilDoCliente, type AtendimentoDoCliente } from './perfil-do-cliente';

const AGORA = new Date('2026-08-14T12:00:00Z');

function visita(dias: number, extra: Partial<AtendimentoDoCliente> = {}): AtendimentoDoCliente {
  return {
    startAt: new Date(AGORA.getTime() - dias * 86_400_000),
    status: 'DONE',
    serviceName: 'Corte',
    priceCents: 5000,
    staffName: 'Marcão',
    ...extra,
  };
}

describe('calcularPerfilDoCliente', () => {
  it('só o atendido vira dinheiro', () => {
    const p = calcularPerfilDoCliente(
      [visita(30), visita(15), visita(1, { status: 'NO_SHOW' }), visita(0, { status: 'BOOKED' })],
      AGORA,
    );
    // o agendado de hoje e a falta não somam: um ainda não aconteceu, o outro não rendeu
    expect(p.totalGastoCents).toBe(10_000);
    expect(p.atendimentos).toBe(2);
  });

  it('o ritmo é a mediana, não a média', () => {
    // 15/15/15/90 — a média dá 34 e esconde quem sumiu; a mediana dá 15
    const p = calcularPerfilDoCliente(
      [visita(135), visita(45), visita(30), visita(15), visita(0)],
      AGORA,
    );
    expect(p.intervaloTipico).toBe(15);
  });

  it('sem duas visitas não há ritmo', () => {
    expect(calcularPerfilDoCliente([visita(10)], AGORA).intervaloTipico).toBeNull();
    expect(calcularPerfilDoCliente([], AGORA).intervaloTipico).toBeNull();
  });

  it('taxa de falta é traço quando não há base, nunca zero', () => {
    // 0% e "nunca teve chance de faltar" são coisas diferentes, e a tela não pode confundir
    expect(calcularPerfilDoCliente([visita(0, { status: 'BOOKED' })], AGORA).taxaDeFalta).toBeNull();
    expect(calcularPerfilDoCliente([], AGORA).taxaDeFalta).toBeNull();
  });

  it('taxa de falta conta falta sobre o que foi marcado e chegou a acontecer', () => {
    const p = calcularPerfilDoCliente(
      [visita(30), visita(20), visita(10, { status: 'NO_SHOW' }), visita(5, { status: 'CANCELED' })],
      AGORA,
    );
    // cancelado não entra: o horário voltou para a grade, ninguém deixou a cadeira vazia
    expect(p.faltas).toBe(1);
    expect(p.taxaDeFalta).toBeCloseTo(1 / 3);
  });

  it('preferido é o mais frequente entre os atendidos, e empate não elege', () => {
    const p = calcularPerfilDoCliente(
      [visita(30), visita(20), visita(10, { serviceName: 'Barba' })],
      AGORA,
    );
    expect(p.servicoPreferido).toBe('Corte');

    const empate = calcularPerfilDoCliente(
      [visita(30), visita(10, { serviceName: 'Barba' })],
      AGORA,
    );
    expect(empate.servicoPreferido).toBeNull();
  });

  it('barbeiro preferido sai do mesmo critério', () => {
    const p = calcularPerfilDoCliente(
      [visita(30), visita(20), visita(10, { staffName: 'Tiago' })],
      AGORA,
    );
    expect(p.barbeiroPreferido).toBe('Marcão');
  });

  it('sumido é passar de 1,5x o próprio ritmo', () => {
    // ritmo 15; ausente há 30 → 30 > 22,5
    const sumiu = calcularPerfilDoCliente([visita(60), visita(45), visita(30)], AGORA);
    expect(sumiu.intervaloTipico).toBe(15);
    expect(sumiu.diasSemVir).toBe(30);
    expect(sumiu.sumido).toBe(true);

    // mesmo ritmo, ausente há 10 → dentro
    const emDia = calcularPerfilDoCliente([visita(40), visita(25), visita(10)], AGORA);
    expect(emDia.sumido).toBe(false);
  });

  it('quem nunca veio não some', () => {
    const p = calcularPerfilDoCliente([visita(0, { status: 'BOOKED' })], AGORA);
    expect(p.ultimaVisita).toBeNull();
    expect(p.diasSemVir).toBeNull();
    expect(p.sumido).toBe(false);
  });

  it('duas visitas no mesmo dia contam como uma', () => {
    // corte e barba na mesma cadeira são uma ida, não duas — senão o ritmo despenca
    const p = calcularPerfilDoCliente(
      [visita(30), visita(30, { serviceName: 'Barba' }), visita(15)],
      AGORA,
    );
    expect(p.intervaloTipico).toBe(15);
  });

  it('com duas visitas há ritmo, mas ainda não há sumiço', () => {
    // um intervalo só tanto pode ser o ritmo da pessoa quanto coincidência — é a
    // mesma exigência de três visitas que `listarSumidos` faz, e a que a Phorest
    // usa para calcular o "sumido" por cliente
    const p = calcularPerfilDoCliente([visita(60), visita(45)], AGORA);
    expect(p.intervaloTipico).toBe(15);
    expect(p.sumido).toBe(false);
  });
});
