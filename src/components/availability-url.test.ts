import { describe, it, expect } from 'vitest';
import { montarUrlDeGrade } from './availability';

const BASE = { slug: 'barbearia-teste', serviceId: 'srv-1', date: '2026-09-07' };

describe('montarUrlDeGrade', () => {
  it('usa a rota pública por padrão', () => {
    expect(montarUrlDeGrade(BASE)).toContain('/api/public/barbearia-teste/availability');
  });

  it('usa a rota do painel quando a origem é o painel', () => {
    const url = montarUrlDeGrade({ ...BASE, origem: 'PANEL' });
    expect(url).toContain('/api/panel/availability');
    expect(url).not.toContain('/api/public/');
  });

  it('a rota do painel não carrega o slug na URL — o tenant vem da sessão', () => {
    const url = montarUrlDeGrade({ ...BASE, origem: 'PANEL' });
    expect(url).not.toContain('barbearia-teste');
  });

  it('leva serviço, data e barbeiro nos dois modos', () => {
    for (const origem of ['PUBLIC', 'PANEL'] as const) {
      const url = montarUrlDeGrade({ ...BASE, staffId: 'stf-1', origem });
      expect(url).toContain('serviceId=srv-1');
      expect(url).toContain('date=2026-09-07');
      expect(url).toContain('staffId=stf-1');
    }
  });

  it('escapa o slug na rota pública', () => {
    expect(montarUrlDeGrade({ ...BASE, slug: 'a/b' })).toContain('a%2Fb');
  });
});
