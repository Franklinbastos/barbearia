import { describe, it, expect } from 'vitest';

import type { IndicadoresDeCliente } from '@/domain/indicadores/cliente';
import { apoioDoRetorno } from './retorno';

function clientes(over: Partial<IndicadoresDeCliente> = {}): IndicadoresDeCliente {
  return {
    atendidos: 10,
    novos: 3,
    recorrentes: 7,
    diasEntreVisitas: 21,
    coorteDeRetorno: 0,
    taxaRetorno: null,
    ...over,
  };
}

describe('apoioDoRetorno', () => {
  it('sem estreante, diz que não há sobre quem medir', () => {
    expect(apoioDoRetorno(clientes({ novos: 0 }))).toBe('ninguém estreou neste período');
  });

  it('com estreante e sem coorte madura, diz que o prazo ainda não fechou', () => {
    // O caso da tela padrão: alguém estreou nesta semana, e ninguém teve 90
    // dias para voltar. O traço sem esta frase pareceria defeito da tela.
    expect(apoioDoRetorno(clientes({ novos: 3, coorteDeRetorno: 0 }))).toBe(
      '3 estreantes ainda têm 90 dias para voltar',
    );
  });

  it('com coorte madura, diz de quantos o percentual saiu', () => {
    expect(apoioDoRetorno(clientes({ novos: 4, coorteDeRetorno: 4, taxaRetorno: 0.5 }))).toBe(
      'de 4 estreantes que já tiveram 90 dias para voltar',
    );
  });

  it('concorda em número no singular', () => {
    expect(apoioDoRetorno(clientes({ novos: 1, coorteDeRetorno: 0 }))).toBe(
      '1 estreante ainda tem 90 dias para voltar',
    );
    expect(apoioDoRetorno(clientes({ novos: 1, coorteDeRetorno: 1, taxaRetorno: 1 }))).toBe(
      'de 1 estreante que já teve 90 dias para voltar',
    );
  });
});
