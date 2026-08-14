import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { resolverPeriodo, janelaAnterior } from './periodo';

const TZ = 'America/Sao_Paulo';
// Sexta-feira, 14/08/2026, 15h em São Paulo.
const AGORA = DateTime.fromISO('2026-08-14T15:00', { zone: TZ });

describe('resolverPeriodo', () => {
  it('sem parâmetro nenhum devolve a semana corrente', () => {
    const j = resolverPeriodo({ timeZone: TZ, agora: AGORA });
    expect(j.periodo).toBe('semana');
    // segunda 00:00 até segunda seguinte 00:00
    expect(DateTime.fromJSDate(j.inicio).setZone(TZ).toISODate()).toBe('2026-08-10');
    expect(DateTime.fromJSDate(j.fim).setZone(TZ).toISODate()).toBe('2026-08-17');
  });

  it('hoje é o dia civil da barbearia, não 24h para trás', () => {
    const j = resolverPeriodo({ periodo: 'hoje', timeZone: TZ, agora: AGORA });
    expect(DateTime.fromJSDate(j.inicio).setZone(TZ).toISO()).toContain('2026-08-14T00:00');
    expect(DateTime.fromJSDate(j.fim).setZone(TZ).toISODate()).toBe('2026-08-15');
  });

  it('mês vai do dia 1 ao dia 1 do mês seguinte', () => {
    const j = resolverPeriodo({ periodo: 'mes', timeZone: TZ, agora: AGORA });
    expect(DateTime.fromJSDate(j.inicio).setZone(TZ).toISODate()).toBe('2026-08-01');
    expect(DateTime.fromJSDate(j.fim).setZone(TZ).toISODate()).toBe('2026-09-01');
  });

  it('intervalo livre respeita as duas pontas, com o fim inclusivo no dia', () => {
    const j = resolverPeriodo({ periodo: 'livre', de: '2026-08-03', ate: '2026-08-09', timeZone: TZ, agora: AGORA });
    expect(DateTime.fromJSDate(j.inicio).setZone(TZ).toISODate()).toBe('2026-08-03');
    // fim exclusivo no dia seguinte: quem marcou às 18h do dia 9 tem que entrar
    expect(DateTime.fromJSDate(j.fim).setZone(TZ).toISODate()).toBe('2026-08-10');
  });

  it('intervalo invertido é corrigido em vez de devolver janela vazia', () => {
    const j = resolverPeriodo({ periodo: 'livre', de: '2026-08-09', ate: '2026-08-03', timeZone: TZ, agora: AGORA });
    expect(j.inicio.getTime()).toBeLessThan(j.fim.getTime());
  });

  it('período desconhecido cai na semana em vez de quebrar', () => {
    expect(resolverPeriodo({ periodo: 'trimestre', timeZone: TZ, agora: AGORA }).periodo).toBe('semana');
  });

  it('usa o fuso da barbearia, não o do servidor', () => {
    const manaus = resolverPeriodo({ periodo: 'hoje', timeZone: 'America/Manaus', agora: AGORA });
    // 15h em SP é 14h em Manaus, mesmo dia civil; o início muda de instante
    expect(manaus.inicio.toISOString()).not.toBe(
      resolverPeriodo({ periodo: 'hoje', timeZone: TZ, agora: AGORA }).inicio.toISOString(),
    );
  });
});

describe('janelaAnterior', () => {
  it('a semana anterior tem a mesma duração e termina onde a atual começa', () => {
    const atual = resolverPeriodo({ timeZone: TZ, agora: AGORA });
    const antes = janelaAnterior(atual, TZ);
    expect(antes.fim.getTime()).toBe(atual.inicio.getTime());
    expect(antes.fim.getTime() - antes.inicio.getTime()).toBe(atual.fim.getTime() - atual.inicio.getTime());
  });

  it('o mês anterior respeita o calendário, não 30 dias fixos', () => {
    const marco = resolverPeriodo({ periodo: 'livre', de: '2026-03-01', ate: '2026-03-31', timeZone: TZ, agora: AGORA });
    const fevereiro = janelaAnterior({ ...marco, periodo: 'mes' }, TZ);
    expect(DateTime.fromJSDate(fevereiro.inicio).setZone(TZ).toISODate()).toBe('2026-02-01');
  });
});
