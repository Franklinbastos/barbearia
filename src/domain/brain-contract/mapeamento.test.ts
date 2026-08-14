import { describe, it, expect } from 'vitest';
import { normalizarTexto, acharPorNome, montarInicio, horaLocal, formatarPreco } from './mapeamento';

describe('normalizarTexto', () => {
  it('tira acento e caixa', () => {
    expect(normalizarTexto('  Barba É Ótima ')).toBe('barba e otima');
  });
});

describe('acharPorNome', () => {
  const itens = [
    { id: 'a', name: 'Corte' },
    { id: 'b', name: 'Barba' },
    { id: 'c', name: 'João' },
  ];

  it('casa ignorando acento e caixa', () => {
    expect(acharPorNome(itens, 'joao')?.id).toBe('c');
    expect(acharPorNome(itens, 'CORTE')?.id).toBe('a');
  });

  it('devolve null sem nome ou sem correspondência', () => {
    expect(acharPorNome(itens, undefined)).toBeNull();
    expect(acharPorNome(itens, '')).toBeNull();
    expect(acharPorNome(itens, 'Sobrancelha')).toBeNull();
  });
});

describe('montarInicio', () => {
  it('junta data e hora no fuso da barbearia', () => {
    // 09:00 em São Paulo (UTC-3) é 12:00Z.
    const instante = montarInicio('2026-08-20', '09:00', 'America/Sao_Paulo');
    expect(instante?.toISOString()).toBe('2026-08-20T12:00:00.000Z');
  });

  it('devolve null para data ou hora ausente/inválida', () => {
    expect(montarInicio(undefined, '09:00', 'America/Sao_Paulo')).toBeNull();
    expect(montarInicio('2026-08-20', undefined, 'America/Sao_Paulo')).toBeNull();
    expect(montarInicio('2026-13-40', '09:00', 'America/Sao_Paulo')).toBeNull();
  });
});

describe('horaLocal', () => {
  it('mostra a hora no fuso da barbearia', () => {
    expect(horaLocal(new Date('2026-08-20T12:00:00.000Z'), 'America/Sao_Paulo')).toBe('09:00');
  });
});

describe('formatarPreco', () => {
  it('formata centavos como real', () => {
    // Normaliza o espaço: algumas builds do Node usam NBSP entre "R$" e o valor.
    const texto = formatarPreco(4000).replace(/\s/g, ' ');
    expect(texto).toBe('R$ 40,00');
  });
});
